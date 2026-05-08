import itertools

from app.models.schemas import ChartConfig, ChartType, ColumnClassification, ColumnType


def fire_rules(classifications: list[ColumnClassification]) -> list[ChartConfig]:
    """Apply R-01 through R-07 to produce a deterministic list of ChartConfigs.

    ordered_category columns are intentionally excluded from R-01 (line charts).
    """
    charts: list[ChartConfig] = []
    counter = itertools.count(1)

    def next_id() -> str:
        return f"chart_{next(counter):03d}"

    date_cols = [c for c in classifications if c.classified_type == ColumnType.date]
    category_cols = [c for c in classifications if c.classified_type == ColumnType.category]
    metric_cols = [c for c in classifications if c.classified_type == ColumnType.metric]
    # ordered_category excluded from R-01 by design

    # R-01: date + metric → line chart (primary metric only, one per date col)
    for date_col in date_cols:
        for metric_col in metric_cols[:1]:
            charts.append(
                ChartConfig(
                    chart_id=next_id(),
                    rule_id="R-01",
                    chart_type=ChartType.line,
                    title=f"{metric_col.column_name} Over Time",
                    x_column=date_col.column_name,
                    y_column=metric_col.column_name,
                    color_column=None,
                    secondary_y_column=None,
                )
            )

    # R-02: category (≤20 unique) + metric → bar chart
    for cat_col in [c for c in category_cols if c.unique_count <= 20]:
        for metric_col in metric_cols[:1]:
            charts.append(
                ChartConfig(
                    chart_id=next_id(),
                    rule_id="R-02",
                    chart_type=ChartType.bar,
                    title=f"{metric_col.column_name} by {cat_col.column_name}",
                    x_column=cat_col.column_name,
                    y_column=metric_col.column_name,
                    color_column=None,
                    secondary_y_column=None,
                )
            )

    # R-03: metric → KPI cards (max 6)
    for metric_col in metric_cols[:6]:
        unit_suffix = f" ({metric_col.unit})" if metric_col.unit else ""
        is_snapshot = (metric_col.aggregation_hint or "sum") == "last"
        kpi_label = "Latest" if is_snapshot else "Total"
        charts.append(
            ChartConfig(
                chart_id=next_id(),
                rule_id="R-03",
                chart_type=ChartType.kpi,
                title=f"{kpi_label} {metric_col.column_name}{unit_suffix}",
                x_column=None,
                y_column=metric_col.column_name,
                color_column=None,
                secondary_y_column=None,
            )
        )

    # R-04: metric with >20 unique values → histogram
    for metric_col in [c for c in metric_cols if c.unique_count > 20]:
        charts.append(
            ChartConfig(
                chart_id=next_id(),
                rule_id="R-04",
                chart_type=ChartType.histogram,
                title=f"Distribution of {metric_col.column_name}",
                x_column=metric_col.column_name,
                y_column=None,
                color_column=None,
                secondary_y_column=None,
            )
        )

    # R-05: category (≤8 unique) + metric → donut (subset of R-02 candidates)
    for cat_col in [c for c in category_cols if c.unique_count <= 8]:
        for metric_col in metric_cols[:1]:
            charts.append(
                ChartConfig(
                    chart_id=next_id(),
                    rule_id="R-05",
                    chart_type=ChartType.donut,
                    title=f"{metric_col.column_name} by {cat_col.column_name}",
                    x_column=cat_col.column_name,
                    y_column=metric_col.column_name,
                    color_column=None,
                    secondary_y_column=None,
                )
            )

    # R-06: always → summary table
    charts.append(
        ChartConfig(
            chart_id=next_id(),
            rule_id="R-06",
            chart_type=ChartType.summary_table,
            title="Data Summary",
            x_column=None,
            y_column=None,
            color_column=None,
            secondary_y_column=None,
        )
    )

    # R-07: two metric cols → scatter (first two metrics, colour by first category)
    if len(metric_cols) >= 2:
        charts.append(
            ChartConfig(
                chart_id=next_id(),
                rule_id="R-07",
                chart_type=ChartType.scatter,
                title=f"{metric_cols[0].column_name} vs {metric_cols[1].column_name}",
                x_column=metric_cols[0].column_name,
                y_column=metric_cols[1].column_name,
                color_column=category_cols[0].column_name if category_cols else None,
                secondary_y_column=None,
            )
        )

    return charts
