from app.models.schemas import ColumnSummary


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

        if len(col.sample_values) > 10:
            warnings.append(
                f"Column '{col.name}': sample_values truncated to 10"
            )
            updates["sample_values"] = col.sample_values[:10]

        if col.mean is not None and (col.min is None or col.max is None):
            warnings.append(
                f"Column '{col.name}': mean provided without min/max"
            )

        cleaned.append(col.model_copy(update=updates) if updates else col)

    return cleaned, warnings
