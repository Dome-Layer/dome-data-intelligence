"""Auth endpoints — session deletion."""

from fastapi import APIRouter, Request

from app.core.db import get_supabase_client

router = APIRouter()


@router.delete("/auth/session", status_code=204)
async def delete_session(req: Request):
    db = get_supabase_client()
    if db is None:
        return  # graceful — no-op when auth not configured
    auth = req.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return
    token = auth.removeprefix("Bearer ").strip()
    try:
        resp = db.auth.get_user(token)
        if resp and resp.user:
            db.auth.admin.sign_out(token)
    except Exception:
        pass  # best-effort
