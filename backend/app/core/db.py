from functools import lru_cache
from typing import Optional


@lru_cache
def get_supabase_client() -> Optional[object]:
    """Return a Supabase client, or None if not configured."""
    from app.core.config import get_settings
    settings = get_settings()

    if not settings.supabase_url or not settings.supabase_service_key:
        return None

    try:
        from supabase import create_client
        return create_client(settings.supabase_url, settings.supabase_service_key)
    except ImportError:
        return None
