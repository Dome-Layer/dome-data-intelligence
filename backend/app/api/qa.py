from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from dome_core.sanitize import sanitize_user_text

from app.core.auth import require_api_key, verify_session_id
from app.core.config import get_llm_provider
from app.core.db import get_supabase_client
from app.core.logging import get_logger
from app.models.schemas import (
    ColumnClassification,
    ColumnSummary,
    HumanInLoop,
    QARequest,
    QAResponse,
)
from app.services.governance import build_qa_governance, log_governance_event

router = APIRouter()
logger = get_logger("api.qa")
limiter = Limiter(key_func=get_remote_address)

_MAX_QUESTION_LEN = 2_000
_MAX_DATA_CONTEXT_LEN = 32_000  # ~8k tokens; prevents runaway prompt size


@router.post("/qa", response_model=QAResponse, dependencies=[Depends(require_api_key)])
@limiter.limit("10/minute")
async def answer_question(request: Request, body: QARequest) -> QAResponse:
    if not body.question.strip():
        raise HTTPException(status_code=422, detail="Question must not be empty")
    if len(body.question) > _MAX_QUESTION_LEN:
        raise HTTPException(
            status_code=422, detail=f"Question exceeds {_MAX_QUESTION_LEN} characters"
        )

    # Verify the HMAC-signed session token
    session_uuid = verify_session_id(body.session_id)

    # Prefer inline context sent by the frontend (works without Supabase).
    # Fall back to Supabase lookup when inline data is absent.
    column_summary: list[ColumnSummary] = body.column_summary or []
    classifications: list[ColumnClassification] = body.classifications or []

    if not column_summary or not classifications:
        db = get_supabase_client()
        if db:
            try:
                result = (
                    db.table("sessions")
                    .select("column_summary,classifications")
                    .eq("session_id", session_uuid)
                    .execute()
                )
                if not result.data:
                    raise HTTPException(status_code=404, detail="Session not found or expired")
                session_data = result.data[0]
                if session_data.get("column_summary"):
                    column_summary = [ColumnSummary(**c) for c in session_data["column_summary"]]
                if session_data.get("classifications"):
                    classifications = [
                        ColumnClassification(**c) for c in session_data["classifications"]
                    ]
            except HTTPException:
                raise
            except Exception as exc:
                logger.warning("supabase_select_failed", error=str(exc))

    # Truncate data_context to prevent oversized prompts
    raw_data_context = (body.data_context or "")[:_MAX_DATA_CONTEXT_LEN]

    # Call LLM for Q&A
    try:
        provider = get_llm_provider()
        result_data = await provider.answer_question(
            question=sanitize_user_text(body.question),
            column_summary=column_summary,
            classifications=classifications,
            conversation_history=body.conversation_history,
            data_context=raw_data_context,
        )
    except Exception as exc:
        logger.error("qa_failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"LLM provider error: {exc}")

    answer = str(result_data.get("answer", ""))
    columns_referenced = list(result_data.get("columns_referenced", []))
    confidence = float(result_data.get("confidence", 0.8))
    human_in_loop = HumanInLoop.recommended if confidence < 0.6 else HumanInLoop.not_required

    governance = build_qa_governance(
        session_id=body.session_id,
        question=body.question,
        columns_referenced=columns_referenced,
        history_turns=len(body.conversation_history),
        confidence=confidence,
    )
    log_governance_event(governance)

    logger.info(
        "qa_answered",
        session_id=body.session_id,
        question_length=len(body.question),
        columns_referenced=columns_referenced,
        confidence=confidence,
    )

    return QAResponse(
        answer=answer,
        columns_referenced=columns_referenced,
        confidence=confidence,
        human_in_loop=human_in_loop,
        governance=governance,
    )
