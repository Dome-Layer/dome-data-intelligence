from abc import ABC, abstractmethod

from app.models.schemas import ColumnClassification, ColumnSummary, ConversationTurn


class LLMProvider(ABC):
    """Abstract base class for all LLM providers."""

    @abstractmethod
    async def classify_columns(
        self,
        column_summary: list[ColumnSummary],
    ) -> list[ColumnClassification]:
        """Classify columns using the LLM. Returns one ColumnClassification per column."""
        ...

    @abstractmethod
    async def answer_question(
        self,
        question: str,
        column_summary: list[ColumnSummary],
        classifications: list[ColumnClassification],
        conversation_history: list[ConversationTurn],
        data_context: str = "",
    ) -> dict:
        """Answer a natural-language question about the dataset.

        Returns a dict with keys:
            answer (str): plain-text answer
            columns_referenced (list[str]): column names mentioned
            confidence (float): 0–1 confidence score
        """
        ...
