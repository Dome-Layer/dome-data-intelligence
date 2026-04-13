"""Auth endpoints — magic-link via Supabase and session deletion."""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.core.db import get_supabase_client

router = APIRouter()


class MagicLinkRequest(BaseModel):
    email: str


@router.post("/auth/magic-link", status_code=204)
async def request_magic_link(body: MagicLinkRequest):
    db = get_supabase_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Auth not configured")
    try:
        db.auth.admin.generate_link({"type": "magiclink", "email": body.email})
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to send magic link") from exc


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
