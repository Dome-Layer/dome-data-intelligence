from app.core.house_style import strip_dashes
from app.models.schemas import ColumnClassification, ColumnSummary
from app.providers.base import LLMProvider


async def classify_columns(
    provider: LLMProvider,
    column_summary: list[ColumnSummary],
) -> list[ColumnClassification]:
    """Classify columns via the given LLM provider.

    Delegates to the provider, then applies the house style (no em or en dashes)
    to the model-written notes, which the user sees. Error handling is the
    caller's responsibility.
    """
    classifications = await provider.classify_columns(column_summary)
    return [
        item.model_copy(update={"note": strip_dashes(item.note)}) if item.note else item
        for item in classifications
    ]
