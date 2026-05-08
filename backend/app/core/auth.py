"""Authentication and session-integrity utilities."""

import hashlib
import hmac
import secrets

from fastapi import HTTPException, Request, Security
from fastapi.security import APIKeyHeader

from app.core.config import get_settings
from app.core.db import get_supabase_client
from app.core.logging import get_logger

logger = get_logger(__name__)

_API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str | None = Security(_API_KEY_HEADER)) -> None:
    """FastAPI dependency: enforce X-API-Key when API_KEY is configured.

    If API_KEY is not set in settings the check is skipped (development mode).
    """
    settings = get_settings()
    if not settings.api_key:
        return  # auth disabled
    if not api_key or not secrets.compare_digest(api_key, settings.api_key):
        raise HTTPException(status_code=403, detail="Invalid or missing API key")


# ---------------------------------------------------------------------------
# HMAC-signed session tokens
# ---------------------------------------------------------------------------
# Session IDs take the form  "{uuid}.{hmac_hex[:16]}"
# The UUID is generated server-side; the HMAC prevents clients from forging
# or guessing valid session identifiers.
# ---------------------------------------------------------------------------

_HMAC_SIG_LEN = 16  # hex characters kept from the full SHA-256 digest


def sign_session_id(session_uuid: str) -> str:
    """Return a signed session token: '{uuid}.{hmac_prefix}'."""
    settings = get_settings()
    secret = settings.session_signing_secret.encode()
    sig = hmac.new(secret, session_uuid.encode(), hashlib.sha256).hexdigest()[:_HMAC_SIG_LEN]
    return f"{session_uuid}.{sig}"


def verify_session_id(session_id: str) -> str:
    """Verify the HMAC suffix and return the raw UUID.

    Raises HTTP 403 if the token is missing, malformed, or tampered with.
    """
    if not session_id or "." not in session_id:
        raise HTTPException(status_code=403, detail="Invalid session token")

    uuid_part, sig_part = session_id.rsplit(".", 1)
    settings = get_settings()
    secret = settings.session_signing_secret.encode()
    expected_sig = hmac.new(secret, uuid_part.encode(), hashlib.sha256).hexdigest()[:_HMAC_SIG_LEN]

    if not secrets.compare_digest(sig_part, expected_sig):
        raise HTTPException(status_code=403, detail="Invalid session token")

    return uuid_part


def get_current_user(request: Request) -> dict:
    """Dependency: extract and verify the Supabase auth token.
    Returns a dict with 'user_id' and 'email'.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")

    token = auth_header.removeprefix("Bearer ").strip()
    supabase = get_supabase_client()

    if supabase is None:
        raise HTTPException(status_code=503, detail="Auth not configured.")

    try:
        user_response = supabase.auth.get_user(token)
        user = user_response.user
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
        return {"user_id": user.id, "email": user.email}
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("auth_verification_failed", error=str(e))
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
