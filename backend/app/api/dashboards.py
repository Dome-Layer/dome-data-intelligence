"""Saved dashboards endpoints — backed by Supabase when configured."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

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


@router.delete("/dashboards/{dashboard_id}", status_code=204)
async def delete_dashboard(dashboard_id: str, req: Request):
    user_id = _require_user(req)
    db = _require_db()
    try:
        db.table("saved_dashboards").delete().eq("id", dashboard_id).eq("user_id", user_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to delete dashboard") from exc
