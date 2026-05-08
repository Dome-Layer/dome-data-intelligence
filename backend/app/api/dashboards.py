"""Saved dashboards endpoints — backed by Supabase when configured."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.core.auth import verify_session_id
from app.core.db import get_supabase_client
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


def _extract_user_id(req: Request) -> Optional[str]:
    """Extract authenticated user_id from the Bearer token via Supabase."""
    db = get_supabase_client()
    if db is None:
        return None
    auth = req.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.removeprefix("Bearer ").strip()
    try:
        resp = db.auth.get_user(token)
        return str(resp.user.id) if resp and resp.user else None
    except Exception:
        return None


def _require_user(req: Request) -> str:
    user_id = _extract_user_id(req)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


def _require_db():
    db = get_supabase_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured")
    return db


# ─── Models ──────────────────────────────────────────────────────────────────


class SaveDashboardRequest(BaseModel):
    filename: str
    column_count: int
    chart_count: int
    label: Optional[str] = None
    data_context: Optional[str] = None
    column_summary: Optional[list] = None
    classifications: Optional[list] = None
    charts: Optional[list] = None


# ─── Routes ──────────────────────────────────────────────────────────────────


@router.post("/dashboards/{session_id}/save")
async def save_dashboard(session_id: str, body: SaveDashboardRequest, req: Request):
    user_id = _require_user(req)
    db = _require_db()

    # Validate the HMAC-signed session token (raises 400 if tampered)
    verify_session_id(session_id)

    # Build the session snapshot from the frontend payload (the sessions table
    # only stores column_summary; classifications and charts are never written back).
    session_snapshot: dict = {
        "column_summary": body.column_summary or [],
        "classifications": body.classifications or [],
        "charts": body.charts or [],
    }

    try:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "session_id": session_id,
            "user_id": user_id,
            "filename": body.filename,
            "column_count": body.column_count,
            "chart_count": body.chart_count,
            "label": body.label,
            "saved_at": now,
            "session_data": session_snapshot,
            "data_context": body.data_context,
        }
        db.table("saved_dashboards").insert(row).execute()
        return {"saved": True, "saved_at": now}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to save dashboard") from exc


@router.get("/dashboards")
async def list_dashboards(req: Request):
    user_id = _require_user(req)
    db = _require_db()
    try:
        result = (
            db.table("saved_dashboards")
            .select("*")
            .eq("user_id", user_id)
            .order("saved_at", desc=True)
            .execute()
        )
        return {"dashboards": result.data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to list dashboards") from exc


@router.get("/dashboards/{session_id}/restore")
async def restore_dashboard(session_id: str, req: Request):
    """Return stored session data so the frontend can reconstruct a saved dashboard
    without relying on sessionStorage. The user must own the saved dashboard."""
    user_id = _require_user(req)
    db = _require_db()

    # Fetch the saved record (confirms ownership and provides the snapshot)
    saved = (
        db.table("saved_dashboards")
        .select("filename,session_data,data_file,data_context")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not saved.data:
        raise HTTPException(status_code=403, detail="Dashboard not found or access denied")

    row = saved.data[0]
    sd = row.get("session_data")
    if not sd:
        raise HTTPException(status_code=404, detail="Dashboard data not found")

    response: dict = {
        "filename": row["filename"],
        "column_summary": sd.get("column_summary") or [],
        "classifications": sd.get("classifications") or [],
        "charts": sd.get("charts") or [],
        "governance": None,
        "data_context": row.get("data_context"),
    }

    # If raw data was uploaded to Storage, return a 1-hour signed URL
    data_file = row.get("data_file")
    if data_file:
        try:
            signed = db.storage.from_("dashboard-data").create_signed_url(
                path=data_file,
                expires_in=3600,
            )
            # supabase-py returns {"signedURL": "..."} or {"signed_url": "..."} depending on version
            url = (signed or {}).get("signedURL") or (signed or {}).get("signed_url")
            if url:
                response["data_url"] = url
        except Exception:
            pass  # non-fatal — frontend degrades to metadata-only view

    return response


@router.post("/dashboards/{session_id}/data")
async def upload_dashboard_data(
    session_id: str,
    req: Request,
    file: UploadFile = File(...),
):
    """Upload raw CSV data for a saved dashboard to Supabase Storage."""
    user_id = _require_user(req)
    db = _require_db()

    # Confirm the user owns this saved dashboard
    saved = (
        db.table("saved_dashboards")
        .select("id")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not saved.data:
        raise HTTPException(status_code=403, detail="Dashboard not found or access denied")

    session_uuid = verify_session_id(session_id)
    storage_path = f"{user_id}/{session_uuid}/data.csv"
    csv_content = await file.read()

    try:
        db.storage.from_("dashboard-data").upload(
            path=storage_path,
            file=csv_content,
            file_options={"content-type": "text/csv", "upsert": "true"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to upload data to storage") from exc

    # Store the path so the restore endpoint can generate signed URLs later
    try:
        db.table("saved_dashboards").update({"data_file": storage_path}).eq(
            "session_id", session_id
        ).eq("user_id", user_id).execute()
    except Exception as exc:
        logger.warning("data_file_path_update_failed", session_id=session_id, error=str(exc))

    return {"uploaded": True}


@router.delete("/dashboards/{dashboard_id}", status_code=204)
async def delete_dashboard(dashboard_id: str, req: Request):
    user_id = _require_user(req)
    db = _require_db()
    try:
        db.table("saved_dashboards").delete().eq("id", dashboard_id).eq(
            "user_id", user_id
        ).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to delete dashboard") from exc
