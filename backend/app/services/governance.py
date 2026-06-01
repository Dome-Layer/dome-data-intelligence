from datetime import datetime, timezone
from typing import Optional

from dome_core.governance import GovernanceEvent, hash_input_dict

from app.core.db import get_supabase_client
from app.core.logging import get_logger
from app.models.schemas import (
    ChartConfig,
    ColumnClassification,
    HumanInLoop,
)

logger = get_logger("governance")

AGENT_ID = "data-intelligence"
ALL_RULES = ["R-01", "R-02", "R-03", "R-04", "R-05", "R-06", "R-07"]


def _classification_confidence(classifications: list[ColumnClassification]) -> float:
    """Heuristic confidence: columns with notes indicate uncertainty (-0.3 weight)."""
    if not classifications:
        return 0.0
    noted = sum(1 for c in classifications if c.note)
    return round(max(0.0, 1.0 - (noted / len(classifications)) * 0.3), 2)


def build_dashboard_governance(
    session_id: str,
    classifications: list[ColumnClassification],
    charts: list[ChartConfig],
    row_count: int,
    filename: str,
    user_id: Optional[str] = None,
) -> GovernanceEvent:
    rules_triggered = sorted({c.rule_id for c in charts})
    col_count = len(classifications)
    chart_count = len(charts)
    confidence = _classification_confidence(classifications)
    input_hash = hash_input_dict(
        {
            "session_id": session_id,
            "classifications": [c.model_dump() for c in classifications],
        }
    )

    return GovernanceEvent(
        agent_id=AGENT_ID,
        action_type="dashboard_generation",
        timestamp=datetime.now(timezone.utc),
        input_hash=input_hash,
        input_type="spreadsheet",
        output_summary=(
            f"{col_count} columns classified, {chart_count} charts generated, "
            f"rules {' '.join(rules_triggered)} fired"
        ),
        rules_applied=ALL_RULES,
        rules_triggered=rules_triggered,
        confidence=confidence,
        human_in_loop=HumanInLoop.not_required.value,
        user_id=user_id,
        metadata={
            "column_count": col_count,
            "chart_count": chart_count,
            "row_count": row_count,
            "filename": filename,
        },
    )


def build_qa_governance(
    session_id: str,
    question: str,
    columns_referenced: list[str],
    history_turns: int,
    confidence: float,
    user_id: Optional[str] = None,
) -> GovernanceEvent:
    input_hash = hash_input_dict({"session_id": session_id, "question": question})

    return GovernanceEvent(
        agent_id=AGENT_ID,
        action_type="qa_query",
        timestamp=datetime.now(timezone.utc),
        input_hash=input_hash,
        input_type="text",
        output_summary=f"Q&A query answered, {len(columns_referenced)} columns referenced",
        rules_applied=[],
        rules_triggered=[],
        confidence=confidence,
        human_in_loop=HumanInLoop.recommended.value
        if confidence < 0.6
        else HumanInLoop.not_required.value,
        user_id=user_id,
        metadata={
            "question_length": len(question),
            "columns_referenced": columns_referenced,
            "history_turns": history_turns,
        },
    )


def log_governance_event(event: GovernanceEvent) -> None:
    logger.info(
        "governance_event",
        agent_id=event.agent_id,
        action_type=event.action_type,
        timestamp=event.timestamp.isoformat(),
        input_hash=event.input_hash,
        input_type=event.input_type,
        output_summary=event.output_summary,
        rules_triggered=event.rules_triggered,
        confidence=event.confidence,
        human_in_loop=event.human_in_loop,
        metadata=event.metadata,
    )

    # Persist to the shared governance_events audit table (best-effort: a
    # persistence failure must never break the main dashboard/Q&A flow). DA-003.
    try:
        db = get_supabase_client()
        if db is None:
            return
        db.table("governance_events").insert(
            {
                "agent_id": event.agent_id,
                "action_type": event.action_type,
                "timestamp": event.timestamp.isoformat(),
                "input_hash": event.input_hash,
                "input_type": event.input_type,
                "output_summary": event.output_summary,
                "rules_applied": event.rules_applied,
                "rules_triggered": event.rules_triggered,
                "confidence": event.confidence,
                "human_in_loop": event.human_in_loop,
                "user_id": event.user_id,
                "workflow_run_id": event.workflow_run_id,
                "metadata": event.metadata,
            }
        ).execute()
    except Exception as e:
        logger.error("governance_event_failed", error=str(e))
