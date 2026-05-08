from app.core.config import Settings
from app.models.schemas import ColumnClassification, ColumnSummary, ConversationTurn
from app.providers.base import LLMProvider


class AzureOpenAIProvider(LLMProvider):
    """Azure OpenAI provider stub — not yet implemented."""

    def __init__(self, settings: Settings) -> None:
        self.endpoint = settings.azure_openai_endpoint
        self.key = settings.azure_openai_key
        self.deployment = settings.azure_openai_deployment

    async def classify_columns(
        self,
        column_summary: list[ColumnSummary],
    ) -> list[ColumnClassification]:
        raise NotImplementedError("AzureOpenAIProvider is not yet implemented")

    async def answer_question(
        self,
        question: str,
        column_summary: list[ColumnSummary],
        classifications: list[ColumnClassification],
        conversation_history: list[ConversationTurn],
    ) -> dict:
        raise NotImplementedError("AzureOpenAIProvider is not yet implemented")
