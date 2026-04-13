from typing import Optional

_supabase_client = None


def get_supabase_client() -> Optional[object]:
    """Return a Supabase client, or None if not configured."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    from app.core.config import get_settings
    settings = get_settings()

    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        return _supabase_client
    except ImportError:
        return None
