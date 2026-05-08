from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.auth import require_api_key, verify_session_id
from app.core.config import get_llm_provider
from app.core.db import get_supabase_client
from app.core.logging import get_logger
from app.models.schemas import DashboardRequest, DashboardResponse
from app.services.classifier import classify_columns
from app.services.governance import build_dashboard_governance, log_governance_event
from app.services.rules_engine import fire_rules

router = APIRouter()
logger = get_logger("api.dashboard")
limiter = Limiter(key_func=get_remote_address)


@router.post(
    "/dashboard", response_model=DashboardResponse, dependencies=[Depends(require_api_key)]
)
@limiter.limit("10/minute")
async def generate_dashboard(request: Request, body: DashboardRequest) -> DashboardResponse:
    # Verify the HMAC-signed session token before doing any work
    session_uuid = verify_session_id(body.session_id)

    # Fetch session metadata from Supabase; graceful fallback when DB not configured
    filename = "unknown"
    row_count = 0

    db = get_supabase_client()
    if db:
        try:
            result = (
                db.table("sessions")
                .select("filename,row_count")
                .eq("session_id", session_uuid)
                .execute()
            )
            if not result.data:
                raise HTTPException(status_code=404, detail="Session not found or expired")
            filename = result.data[0]["filename"]
            row_count = result.data[0]["row_count"]
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("supabase_select_failed", error=str(exc))

    # Classify columns via LLM
    try:
        provider = get_llm_provider()
        classifications = await classify_columns(provider, body.column_summary)
    except Exception as exc:
        logger.error("classification_failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"LLM provider error: {exc}")

    # Run rules engine
    charts = fire_rules(classifications)

    # Build + emit governance event
    governance = build_dashboard_governance(
        session_id=body.session_id,
        classifications=classifications,
        charts=charts,
        row_count=row_count,
        filename=filename,
    )
    log_governance_event(governance)

    # Persist classifications and charts back to Supabase
    if db:
        try:
            db.table("sessions").update(
                {
                    "classifications": [c.model_dump() for c in classifications],
                    "charts": [c.model_dump() for c in charts],
                    "governance": governance.model_dump(mode="json"),
                }
            ).eq("session_id", session_uuid).execute()
        except Exception as exc:
            logger.warning("supabase_update_failed", error=str(exc))

    logger.info(
        "dashboard_generated",
        session_id=body.session_id,
        column_count=len(classifications),
        chart_count=len(charts),
        rules_triggered=governance.rules_triggered,
    )

    return DashboardResponse(
        session_id=body.session_id,
        classifications=classifications,
        charts=charts,
        governance=governance,
    )
