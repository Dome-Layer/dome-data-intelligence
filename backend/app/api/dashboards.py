"""Saved dashboards endpoints — backed by Supabase when configured."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.core.auth import verify_session_id
from app.core.db import get_supabase_client

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


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.post("/dashboards/{session_id}/save")
async def save_dashboard(session_id: str, body: SaveDashboardRequest, req: Request):
    user_id = _require_user(req)
    db = _require_db()

    # Verify and unwrap the HMAC-signed session token → raw UUID
    session_uuid = verify_session_id(session_id)

    # Snapshot the full session data into saved_dashboards so that restores
    # never depend on the sessions table being present later.
    session_snapshot: dict = {}
    try:
        snap = (
            db.table("sessions")
            .select("column_summary,classifications,charts,governance")
            .eq("session_id", session_uuid)
            .execute()
        )
        if snap.data:
            session_snapshot = snap.data[0]
    except Exception:
        pass  # best-effort; restore will fall back to sessions table

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
            "session_data": session_snapshot if session_snapshot else None,
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
        .select("filename,session_data")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not saved.data:
        raise HTTPException(status_code=403, detail="Dashboard not found or access denied")

    row = saved.data[0]

    # Fast path: session data was snapshotted at save time — no sessions table needed
    sd = row.get("session_data")
    if sd:
        return {
            "filename": row["filename"],
            "column_summary": sd.get("column_summary") or [],
            "classifications": sd.get("classifications") or [],
            "charts": sd.get("charts") or [],
            "governance": sd.get("governance"),
        }

    # Legacy path: older saves didn't store the snapshot → fall back to sessions table
    session_uuid = verify_session_id(session_id)
    result = (
        db.table("sessions")
        .select("filename,column_summary,classifications,charts,governance")
        .eq("session_id", session_uuid)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Session data not found")

    row = result.data[0]
    return {
        "filename": row["filename"],
        "column_summary": row.get("column_summary") or [],
        "classifications": row.get("classifications") or [],
        "charts": row.get("charts") or [],
        "governance": row.get("governance"),
    }


@router.delete("/dashboards/{dashboard_id}", status_code=204)
async def delete_dashboard(dashboard_id: str, req: Request):
    user_id = _require_user(req)
    db = _require_db()
    try:
        db.table("saved_dashboards").delete().eq("id", dashboard_id).eq("user_id", user_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to delete dashboard") from exc
