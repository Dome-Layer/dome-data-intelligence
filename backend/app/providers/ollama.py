from app.core.config import Settings
from app.models.schemas import ColumnClassification, ColumnSummary, ConversationTurn
from app.providers.base import LLMProvider


class OllamaProvider(LLMProvider):
    """Ollama provider stub — not yet implemented."""

    def __init__(self, settings: Settings) -> None:
        self.url = settings.ollama_url

    async def classify_columns(
        self,
        column_summary: list[ColumnSummary],
    ) -> list[ColumnClassification]:
        raise NotImplementedError("OllamaProvider is not yet implemented")

    async def answer_question(
        self,
        question: str,
        column_summary: list[ColumnSummary],
        classifications: list[ColumnClassification],
        conversation_history: list[ConversationTurn],
    ) -> dict:
        raise NotImplementedError("OllamaProvider is not yet implemented")
