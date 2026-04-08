from app.models.schemas import ColumnSummary, ColumnClassification
from app.providers.base import LLMProvider


async def classify_columns(
    provider: LLMProvider,
    column_summary: list[ColumnSummary],
) -> list[ColumnClassification]:
    """Classify columns via the given LLM provider.

    Delegates entirely to the provider; error handling is the caller's responsibility.
    """
    return await provider.classify_columns(column_summary)
