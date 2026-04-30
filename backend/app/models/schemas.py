from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal
from enum import Enum


# --- Enums ---

class ColumnType(str, Enum):
    date = "date"
    ordered_category = "ordered_category"
    category = "category"
    metric = "metric"


class ChartType(str, Enum):
    line = "line"
    bar = "bar"
    kpi = "kpi"
    histogram = "histogram"
    donut = "donut"
    summary_table = "summary_table"
    scatter = "scatter"


class HumanInLoop(str, Enum):
    not_required = "not_required"
    recommended = "recommended"
    required = "required"
    completed = "completed"


# --- Column Summary (client → server) ---

class ColumnSummary(BaseModel):
    name: str
    dtype: str
    unique_count: int
    null_count: int
    sample_values: list[str]
    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None


# --- Upload ---

class UploadRequest(BaseModel):
    filename: str
    row_count: int
    column_summary: list[ColumnSummary]


class UploadResponse(BaseModel):
    session_id: str
    filename: str
    row_count: int
    column_count: int
    column_summary: list[ColumnSummary]
    parse_warnings: list[str]


# --- Classification ---

class ColumnClassification(BaseModel):
    column_name: str
    classified_type: ColumnType
    unique_count: int
    can_be_negative: bool
    is_ordinal: bool
    unit: Optional[str] = None
    note: Optional[str] = None
    aggregation_hint: Optional[str] = "sum"  # "sum" for flow metrics, "last" for snapshot metrics


# --- Charts ---

class ChartConfig(BaseModel):
    chart_id: str
    rule_id: str
    chart_type: ChartType
    title: str
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    color_column: Optional[str] = None
    secondary_y_column: Optional[str] = None


# --- Governance ---

class GovernanceEvent(BaseModel):
    agent_id: str
    action_type: str
    timestamp: datetime
    input_hash: str
    input_type: str
    output_summary: str
    rules_applied: list[str]
    rules_triggered: list[str]
    confidence: Optional[float] = None
    human_in_loop: HumanInLoop
    user_id: Optional[str] = None
    workflow_run_id: Optional[str] = None
    metadata: dict


# --- Dashboard ---

class DashboardRequest(BaseModel):
    session_id: str
    column_summary: list[ColumnSummary]


class DashboardResponse(BaseModel):
    session_id: str
    classifications: list[ColumnClassification]
    charts: list[ChartConfig]
    governance: GovernanceEvent


# --- Q&A ---

class ConversationTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class QARequest(BaseModel):
    session_id: str
    question: str
    conversation_history: list[ConversationTurn]
    # Optional inline context — sent by the frontend so Q&A works without Supabase
    column_summary: Optional[list[ColumnSummary]] = None
    classifications: Optional[list[ColumnClassification]] = None
    data_context: Optional[str] = None  # pre-computed aggregations from raw rows


class QAResponse(BaseModel):
    answer: str
    columns_referenced: list[str]
    confidence: float
    human_in_loop: HumanInLoop
    governance: GovernanceEvent


# --- Shared ---

class ErrorResponse(BaseModel):
    detail: str
    code: str
