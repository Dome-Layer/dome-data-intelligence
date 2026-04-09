from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    llm_provider: str = "claude"

    # Claude
    anthropic_api_key: Optional[str] = None

    # Azure OpenAI
    azure_openai_endpoint: Optional[str] = None
    azure_openai_key: Optional[str] = None
    azure_openai_deployment: Optional[str] = None

    # Ollama
    ollama_url: str = "http://localhost:11434"

    # Supabase
    supabase_url: Optional[str] = None
    supabase_service_key: Optional[str] = None

    # Security
    # Shared secret required in X-API-Key header for all non-health endpoints.
    # Leave empty to disable auth (development only).
    api_key: Optional[str] = None
    # HMAC secret used to sign/verify session IDs.
    # MUST be set to a random 32+ char string in production.
    session_signing_secret: str = "change-me-in-production-use-32-random-chars"

    # App
    allowed_origins: str = "http://localhost:3000"
    environment: str = "development"
    max_row_count: int = 50_000

    model_config = {"env_file": ".env", "case_sensitive": False}

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_llm_provider():
    """Factory: return the configured LLMProvider instance."""
    from app.providers.claude import ClaudeProvider
    from app.providers.azure_openai import AzureOpenAIProvider
    from app.providers.ollama import OllamaProvider

    settings = get_settings()
    providers = {
        "claude": ClaudeProvider,
        "azure_openai": AzureOpenAIProvider,
        "ollama": OllamaProvider,
    }
    cls = providers.get(settings.llm_provider)
    if cls is None:
        raise ValueError(f"Unknown LLM_PROVIDER: {settings.llm_provider!r}")
    return cls(settings)
