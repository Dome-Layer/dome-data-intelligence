import re

from app.models.schemas import ColumnSummary

# Strip control characters (C0, DEL, C1) from sample values to prevent
# injection of escape sequences or prompt-manipulation payloads.
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x1f\x7f-\x9f]")
_MAX_SAMPLE_VALUE_LEN = 100  # characters per value


def _sanitize_sample_value(v: object) -> str:
    """Convert a sample value to a clean string safe for LLM injection."""
    s = str(v)[:_MAX_SAMPLE_VALUE_LEN]
    return _CONTROL_CHAR_RE.sub("", s)


def validate_column_summary(
    column_summary: list[ColumnSummary],
    row_count: int,
) -> tuple[list[ColumnSummary], list[str]]:
    """Validate and sanitise a client-supplied column summary.

    Returns (cleaned_columns, warnings).
    Raises ValueError for unrecoverable problems.
    """
    if not column_summary:
        raise ValueError("column_summary must not be empty")

    warnings: list[str] = []
    cleaned: list[ColumnSummary] = []

    for col in column_summary:
        updates: dict = {}

        if col.null_count > row_count:
            warnings.append(
                f"Column '{col.name}': null_count ({col.null_count}) > row_count, clamped"
            )
            updates["null_count"] = row_count

        if col.unique_count > row_count:
            warnings.append(
                f"Column '{col.name}': unique_count ({col.unique_count}) > row_count, clamped"
            )
            updates["unique_count"] = row_count

        # Sanitize sample values: strip control chars, cap length per value
        sanitized_samples = [_sanitize_sample_value(v) for v in col.sample_values]
        if sanitized_samples != list(col.sample_values):
            updates["sample_values"] = sanitized_samples

        if len(col.sample_values) > 10:
            warnings.append(
                f"Column '{col.name}': sample_values truncated to 10"
            )
            updates["sample_values"] = (updates.get("sample_values", sanitized_samples))[:10]

        if col.mean is not None and (col.min is None or col.max is None):
            warnings.append(
                f"Column '{col.name}': mean provided without min/max"
            )

        cleaned.append(col.model_copy(update=updates) if updates else col)

    return cleaned, warnings
