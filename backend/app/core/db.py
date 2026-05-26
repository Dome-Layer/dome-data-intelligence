from dome_core.db import get_db_optional

from app.core.config import get_settings


def get_supabase_client():
    settings = get_settings()
    return get_db_optional(
        url=settings.supabase_url, service_role_key=settings.supabase_service_role_key
    )


__all__ = ["get_supabase_client"]
