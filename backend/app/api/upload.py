import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.schemas import UploadRequest, UploadResponse
from app.services.parser import validate_column_summary
from app.core.config import get_settings
from app.core.auth import require_api_key, sign_session_id
from app.core.db import get_supabase_client
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger("api.upload")
limiter = Limiter(key_func=get_remote_address)


@router.post("/upload", response_model=UploadResponse, status_code=201,
             dependencies=[Depends(require_api_key)])
@limiter.limit("30/minute")
async def upload_summary(request: Request, body: UploadRequest) -> UploadResponse:
    settings = get_settings()

    if body.row_count > settings.max_row_count:
        raise HTTPException(
            status_code=413,
            detail=f"row_count {body.row_count} exceeds limit of {settings.max_row_count}",
        )

    try:
        columns, warnings = validate_column_summary(body.column_summary, body.row_count)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    session_id = sign_session_id(str(uuid.uuid4()))

    db = get_supabase_client()
    if db:
        try:
            db.table("sessions").insert({
                "session_id": session_id,
                "filename": body.filename,
                "row_count": body.row_count,
                "column_summary": [c.model_dump() for c in columns],
            }).execute()
        except Exception as exc:
            logger.warning("supabase_insert_failed", error=str(exc))

    logger.info(
        "upload_received",
        session_id=session_id,
        filename=body.filename,
        row_count=body.row_count,
        column_count=len(columns),
        warnings=len(warnings),
    )

    return UploadResponse(
        session_id=session_id,
        filename=body.filename,
        row_count=body.row_count,
        column_count=len(columns),
        column_summary=columns,
        parse_warnings=warnings,
    )
