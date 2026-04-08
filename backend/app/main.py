from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.api import upload, dashboard, qa

settings = get_settings()
configure_logging(settings.environment)

app = FastAPI(
    title="Dome Data Intelligence API",
    version="1.0.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(qa.router, prefix="/api/v1")


@app.get("/api/v1/health")
@app.head("/api/v1/health")
async def health() -> dict:
    return {"status": "ok", "version": "1.0.0"}
