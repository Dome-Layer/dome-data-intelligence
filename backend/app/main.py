from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.api import upload, dashboard, qa, dashboards, auth as auth_router

settings = get_settings()
configure_logging(settings.environment)

# ---------------------------------------------------------------------------
# Production safety check — fail loudly if insecure defaults are still set
# ---------------------------------------------------------------------------
_DEFAULT_SECRET = "change-me-in-production-use-32-random-chars"
if settings.environment == "production" and settings.session_signing_secret == _DEFAULT_SECRET:
    import logging as _logging
    _logging.critical(
        "SESSION_SIGNING_SECRET is still set to the default placeholder value. "
        "Session tokens can be forged by anyone who has read this source code. "
        "Set SESSION_SIGNING_SECRET to a random 32+ character string "
        "(generate one with: openssl rand -hex 32) and redeploy immediately."
    )

# ---------------------------------------------------------------------------
# Rate limiter (in-memory; use Redis for multi-process deployments)
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Dome Data Intelligence API",
    version="1.0.0",
    # Disable interactive docs in production to reduce attack surface
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains"
            )
        return response


# ---------------------------------------------------------------------------
# Request body size limit middleware (1 MB)
# ---------------------------------------------------------------------------
_MAX_BODY_BYTES = 1_048_576  # 1 MB


class LimitBodySizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length is not None and int(content_length) > _MAX_BODY_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Request body too large (max {_MAX_BODY_BYTES} bytes)"},
                )
        return await call_next(request)


# Middleware is applied last-registered-first, so order matters:
# SecurityHeaders → LimitBodySize → CORS → route handler

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(LimitBodySizeMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key", "Authorization"],
)

app.include_router(upload.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(qa.router, prefix="/api/v1")
app.include_router(dashboards.router, prefix="/api/v1")
app.include_router(auth_router.router, prefix="/api/v1")


@app.get("/api/v1/health")
@app.head("/api/v1/health")
async def health() -> dict:
    return {"status": "ok", "version": "1.0.0"}
