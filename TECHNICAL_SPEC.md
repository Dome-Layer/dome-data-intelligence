# Dome Data Intelligence — Technical Specification

## API Contract

Base URL: `https://api.domelayer.com/api/v1` (production) / `http://localhost:8000/api/v1` (dev)

---

### POST /api/v1/upload

Receives the column summary extracted client-side. Validates shape, stores summary keyed to a new `session_id` in Supabase, returns session ID and echo of the summary.

**Request — `application/json`:**
```json
{
  "filename": "q3_spend.csv",
  "row_count": 135,
  "column_summary": [
    {
      "name": "Supplier",
      "dtype": "object",
      "unique_count": 15,
      "null_count": 0,
      "sample_values": ["Accenture", "CDW", "Computacenter"],
      "min": null,
      "max": null,
      "mean": null
    },
    {
      "name": "PO_Value_EUR",
      "dtype": "float64",
      "unique_count": 135,
      "null_count": 0,
      "sample_values": ["12450.0", "87320.0", "234100.0"],
      "min": 12000.0,
      "max": 280000.0,
      "mean": 143820.5
    }
  ]
}
```

**Response `201`:**
```json
{
  "session_id": "uuid4",
  "filename": "q3_spend.csv",
  "row_count": 135,
  "column_count": 8,
  "column_summary": [ /* echo of request */ ],
  "parse_warnings": []
}
```

**Errors:**
| Code | Reason |
|---|---|
| `422` | Malformed column summary |
| `413` | row_count exceeds limit (50,000) |

---

### POST /api/v1/dashboard

Classifies columns via LLM, runs rules engine, returns dashboard config. Emits GovernanceEvent.

**Request — `application/json`:**
```json
{
  "session_id": "uuid4",
  "column_summary": [ /* array from /upload response */ ]
}
```

**Response `200`:**
```json
{
  "session_id": "uuid4",
  "classifications": [
    {
      "column_name": "Supplier",
      "classified_type": "category",
      "unique_count": 15,
      "can_be_negative": false,
      "is_ordinal": false,
      "unit": null,
      "note": null
    },
    {
      "column_name": "Month",
      "classified_type": "ordered_category",
      "unique_count": 12,
      "can_be_negative": false,
      "is_ordinal": true,
      "unit": null,
      "note": "month labels Jan–Dec, not ISO dates"
    },
    {
      "column_name": "PO_Value_EUR",
      "classified_type": "metric",
      "unique_count": 135,
      "can_be_negative": false,
      "is_ordinal": false,
      "unit": "EUR",
      "note": null
    }
  ],
  "charts": [
    {
      "chart_id": "chart_001",
      "rule_id": "R-02",
      "chart_type": "bar",
      "title": "Total PO Value by Category",
      "x_column": "Category",
      "y_column": "PO_Value_EUR",
      "color_column": null,
      "secondary_y_column": null
    },
    {
      "chart_id": "chart_002",
      "rule_id": "R-03",
      "chart_type": "kpi",
      "title": "Total PO Value EUR",
      "x_column": null,
      "y_column": "PO_Value_EUR",
      "color_column": null,
      "secondary_y_column": null
    },
    {
      "chart_id": "chart_003",
      "rule_id": "R-05",
      "chart_type": "donut",
      "title": "Transactions by Approval Status",
      "x_column": "Approval_Status",
      "y_column": "PO_Value_EUR",
      "color_column": null,
      "secondary_y_column": null
    },
    {
      "chart_id": "chart_004",
      "rule_id": "R-06",
      "chart_type": "summary_table",
      "title": "Data Summary",
      "x_column": null,
      "y_column": null,
      "color_column": null,
      "secondary_y_column": null
    },
    {
      "chart_id": "chart_005",
      "rule_id": "R-07",
      "chart_type": "scatter",
      "title": "PO Value vs Invoice Value",
      "x_column": "PO_Value_EUR",
      "y_column": "Invoice_Value_EUR",
      "color_column": "Approval_Status",
      "secondary_y_column": null
    }
  ],
  "governance": {
    "agent_id": "data-intelligence",
    "action_type": "dashboard_generation",
    "timestamp": "2024-09-15T09:32:11Z",
    "input_hash": "sha256:a3f9...",
    "input_type": "spreadsheet",
    "output_summary": "8 columns classified, 5 charts generated, rules R-02 R-03 R-05 R-06 R-07 fired",
    "rules_applied": ["R-01","R-02","R-03","R-04","R-05","R-06","R-07"],
    "rules_triggered": ["R-02","R-03","R-05","R-06","R-07"],
    "confidence": 0.91,
    "human_in_loop": "not_required",
    "metadata": {
      "column_count": 8,
      "chart_count": 5,
      "row_count": 135,
      "filename": "q3_spend.csv"
    }
  }
}
```

**Errors:**
| Code | Reason |
|---|---|
| `404` | session_id not found or expired |
| `422` | Column summary malformed |
| `502` | LLM provider unreachable |

---

### POST /api/v1/qa

Natural language Q&A against column summary and classifications. Backend is stateless — full conversation history sent with every request.

**Request — `application/json`:**
```json
{
  "session_id": "uuid4",
  "question": "Which supplier has the highest total PO value?",
  "conversation_history": [
    {
      "role": "user",
      "content": "How many flagged transactions are there?"
    },
    {
      "role": "assistant",
      "content": "There are 11 flagged transactions in the dataset."
    }
  ]
}
```

**Response `200`:**
```json
{
  "answer": "Accenture has the highest total PO value at €847,320 across 6 transactions.",
  "columns_referenced": ["Supplier", "PO_Value_EUR"],
  "confidence": 0.88,
  "human_in_loop": "not_required",
  "governance": {
    "agent_id": "data-intelligence",
    "action_type": "qa_query",
    "timestamp": "2024-09-15T09:34:02Z",
    "input_hash": "sha256:c71d...",
    "input_type": "text",
    "output_summary": "Q&A query answered, 2 columns referenced",
    "rules_applied": [],
    "rules_triggered": [],
    "confidence": 0.88,
    "human_in_loop": "not_required",
    "metadata": {
      "question_length": 47,
      "columns_referenced": ["Supplier", "PO_Value_EUR"],
      "history_turns": 2
    }
  }
}
```

**Errors:**
| Code | Reason |
|---|---|
| `404` | session_id not found or expired |
| `422` | Empty question |
| `502` | LLM provider unreachable |

---

## Pydantic Schemas (`app/models/schemas.py`)

```python
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
    min: Optional[float]
    max: Optional[float]
    mean: Optional[float]


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
    unit: Optional[str]
    note: Optional[str]


# --- Charts ---

class ChartConfig(BaseModel):
    chart_id: str
    rule_id: str
    chart_type: ChartType
    title: str
    x_column: Optional[str]
    y_column: Optional[str]
    color_column: Optional[str]
    secondary_y_column: Optional[str]


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
    confidence: Optional[float]
    human_in_loop: HumanInLoop
    user_id: Optional[str]
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
```

---

## TypeScript Types (`frontend/lib/types.ts`)

```typescript
// Column types
export type ColumnType = 'date' | 'ordered_category' | 'category' | 'metric'
export type ChartType = 'line' | 'bar' | 'kpi' | 'histogram' | 'donut' | 'summary_table' | 'scatter'
export type HumanInLoop = 'not_required' | 'recommended' | 'required' | 'completed'
export type ConversationRole = 'user' | 'assistant'

// Column summary — produced by fileParser.ts, sent to /upload
export interface ColumnSummary {
  name: string
  dtype: string
  unique_count: number
  null_count: number
  sample_values: string[]
  min: number | null
  max: number | null
  mean: number | null
}

// Upload
export interface UploadRequest {
  filename: string
  row_count: number
  column_summary: ColumnSummary[]
}

export interface UploadResponse {
  session_id: string
  filename: string
  row_count: number
  column_count: number
  column_summary: ColumnSummary[]
  parse_warnings: string[]
}

// Classification
export interface ColumnClassification {
  column_name: string
  classified_type: ColumnType
  unique_count: number
  can_be_negative: boolean
  is_ordinal: boolean
  unit: string | null
  note: string | null
}

// Charts
export interface ChartConfig {
  chart_id: string
  rule_id: string
  chart_type: ChartType
  title: string
  x_column: string | null
  y_column: string | null
  color_column: string | null
  secondary_y_column: string | null
}

// Governance
export interface GovernanceEvent {
  agent_id: string
  action_type: string
  timestamp: string
  input_hash: string
  input_type: string
  output_summary: string
  rules_applied: string[]
  rules_triggered: string[]
  confidence: number | null
  human_in_loop: HumanInLoop
  user_id: string | null
  metadata: Record<string, unknown>
}

// Dashboard
export interface DashboardRequest {
  session_id: string
  column_summary: ColumnSummary[]
}

export interface DashboardResponse {
  session_id: string
  classifications: ColumnClassification[]
  charts: ChartConfig[]
  governance: GovernanceEvent
}

// Q&A
export interface ConversationTurn {
  role: ConversationRole
  content: string
}

export interface QARequest {
  session_id: string
  question: string
  conversation_history: ConversationTurn[]
}

export interface QAResponse {
  answer: string
  columns_referenced: string[]
  confidence: number
  human_in_loop: HumanInLoop
  governance: GovernanceEvent
}

// Client-side only — never sent to backend
export type DataRow = Record<string, string | number | null>

export interface ParsedFile {
  filename: string
  rowCount: number
  columnSummary: ColumnSummary[]
  rows: DataRow[]
}

export interface SortState {
  column: string
  direction: 'asc' | 'desc'
}
```

---

## LLM Prompts (`app/core/prompts.py`)

### Column Classifier System Prompt

```
You are a data column classifier for a governed analytics platform.

You receive a column summary for a spreadsheet — column names, data types, unique value counts, null counts, sample values, and numeric aggregates where applicable.

Your task is to classify each column into exactly one of these types:

- date: ISO date strings (YYYY-MM-DD, YYYY-MM, etc.) or parseable date formats. Must be actual calendar dates, not labels.
- ordered_category: categorical values with a natural order that are NOT calendar dates. Examples: "Q1 2024", "Q2 2024"; "Jan 2024", "Feb 2024"; "Low", "Medium", "High"; "Stage 1", "Stage 2".
- category: unordered categorical values (names, codes, labels, statuses, flags).
- metric: numeric values intended for aggregation (sum, average, min, max). Includes integers and floats. May be negative.

Rules:
- A column with values like "Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024" is ordered_category, NOT date.
- A column with values like "Jan 2024", "Feb 2024" is ordered_category, NOT date.
- Only classify as date if the values are genuine ISO dates or unambiguous calendar timestamps.
- For metric columns, set unit if detectable from the column name (EUR, USD, MT, %, etc.).
- For metric columns, set can_be_negative: true if min < 0 or the column name implies it (Variance, Net, Exposure, etc.).
- For category columns with a natural rank order, set is_ordinal: true.
- Add a note only when the classification requires explanation (e.g. "quarterly labels, not ISO dates").

Respond ONLY with a JSON array. No preamble, no markdown fences, no explanation.

Example output:
[
  {"column_name": "Date", "classified_type": "date", "unique_count": 28, "can_be_negative": false, "is_ordinal": false, "unit": null, "note": null},
  {"column_name": "Commodity", "classified_type": "category", "unique_count": 7, "can_be_negative": false, "is_ordinal": false, "unit": null, "note": null},
  {"column_name": "Net_Exposure_USD", "classified_type": "metric", "unique_count": 28, "can_be_negative": true, "is_ordinal": false, "unit": "USD", "note": null},
  {"column_name": "Risk_Flag", "classified_type": "category", "unique_count": 3, "can_be_negative": false, "is_ordinal": true, "unit": null, "note": "OK < MONITOR < REVIEW"}
]
```

### Q&A System Prompt

```
You are a data analyst assistant for a governed analytics platform.

You have access to a column summary for a spreadsheet the user has uploaded. You do NOT have access to the raw rows — only column names, types, statistics, and sample values.

Column summary:
{column_summary}

Column classifications:
{classifications}

Answer the user's question based on this summary. Be specific and concise. Reference column names and statistics directly. If the question cannot be answered from the summary alone, say so clearly and explain what additional data would be needed.

Do not hallucinate values. If a statistic is not in the summary, say it is not available.

Always respond in plain text. No markdown, no lists unless the question explicitly asks for a list.
```

---

## Rules Engine Logic (`app/services/rules_engine.py`)

```python
# Pseudocode — implement in full during Session 1

def fire_rules(classifications: list[ColumnClassification]) -> list[ChartConfig]:
    charts = []
    date_cols = [c for c in classifications if c.classified_type == "date"]
    category_cols = [c for c in classifications if c.classified_type == "category"]
    metric_cols = [c for c in classifications if c.classified_type == "metric"]
    # ordered_category cols intentionally excluded from R-01

    # R-01: date + metric → line chart (one per date col × primary metric)
    for date_col in date_cols:
        for metric_col in metric_cols[:1]:  # primary metric only
            charts.append(ChartConfig(rule_id="R-01", chart_type="line", ...))

    # R-02: category (≤20 unique) + metric → bar chart
    for cat_col in [c for c in category_cols if c.unique_count <= 20]:
        for metric_col in metric_cols[:1]:
            charts.append(ChartConfig(rule_id="R-02", chart_type="bar", ...))

    # R-03: metric only → KPI cards (one per metric col, max 6)
    for metric_col in metric_cols[:6]:
        charts.append(ChartConfig(rule_id="R-03", chart_type="kpi", ...))

    # R-04: metric with >20 unique values → histogram
    for metric_col in [c for c in metric_cols if c.unique_count > 20]:
        charts.append(ChartConfig(rule_id="R-04", chart_type="histogram", ...))

    # R-05: category (≤8 unique) + metric → donut (subset of R-02 cols)
    for cat_col in [c for c in category_cols if c.unique_count <= 8]:
        for metric_col in metric_cols[:1]:
            charts.append(ChartConfig(rule_id="R-05", chart_type="donut", ...))

    # R-06: always → summary table
    charts.append(ChartConfig(rule_id="R-06", chart_type="summary_table", ...))

    # R-07: two metric cols → scatter (first two metric cols)
    if len(metric_cols) >= 2:
        charts.append(ChartConfig(
            rule_id="R-07", chart_type="scatter",
            x_column=metric_cols[0].column_name,
            y_column=metric_cols[1].column_name,
            color_column=category_cols[0].column_name if category_cols else None,
            ...
        ))

    return charts
```

---

## DataTable Component Spec (`frontend/components/dashboard/DataTable.tsx`)

- **Trigger:** "View Data" button in dashboard header
- **Position:** Full-width panel below chart grid, toggled show/hide
- **Data source:** `rows: DataRow[]` from `ParsedFile` — React state, never fetched from backend
- **Pagination:** 50 rows per page
- **Sorting:** Click column header to sort asc/desc
- **Column highlighting:** When a chart is active, columns it references receive accent-cyan header underline
- **Disclosure banner:** `"YOUR DATA HAS NOT BEEN UPLOADED — ALL ROWS ARE PROCESSED LOCALLY IN YOUR BROWSER"` — JetBrains Mono, 11px, accent-cyan, uppercase
- **Export:** "Download CSV" button re-exports rows from React state via Blob URL

---

## Client-Side Parsing (`frontend/lib/fileParser.ts`)

Responsibilities:
1. Detect file type from extension (`.csv`, `.xlsx`, `.xls`, `.xlsm`, `.xlsb`)
2. Parse using PapaParse (CSV) or SheetJS (all Excel variants)
3. Extract `ColumnSummary` for each column:
   - `dtype`: inferred from values (`object`, `float64`, `int64`)
   - `unique_count`: `new Set(values).size`
   - `null_count`: count of null/undefined/empty string
   - `sample_values`: first 3 non-null distinct values, as strings
   - `min` / `max` / `mean`: computed for numeric columns only, null otherwise
4. Return `ParsedFile` — `columnSummary` goes to `/upload`, `rows` stay in React state

Column summary extraction must produce output identical in shape to `backend/app/services/parser.py`. `lib/types.ts` is the shared contract.

---

## Deployment

### Backend (Railway)
- Root directory: `backend/`
- Build: Dockerfile
- Port: `${PORT:-8000}`
- Health endpoint: `GET /api/v1/health` (accepts GET + HEAD)

### Frontend (Vercel)
- Root directory: `frontend/`
- Framework: Next.js
- Custom domain: `data.domelayer.com`

### Supabase
- Auth: magic link, Site URL = `https://data.domelayer.com`
- Custom SMTP: Resend (`smtp.resend.com:465`, `noreply@domelayer.com`)
- Table: `sessions` — stores `session_id`, `filename`, `column_summary` (JSONB), `classifications` (JSONB), `charts` (JSONB), `user_id`, `created_at`

---

## Governance Log Schema

Every `/dashboard` and `/qa` response includes a `GovernanceEvent`. The backend also persists it via `structlog` (metadata only, no content). See `DOME_CONTEXT.md` for the full schema definition.

Key fields per action type:

| Action | `input_type` | `rules_applied` | Notable metadata |
|---|---|---|---|
| `dashboard_generation` | `spreadsheet` | R-01 through R-07 | `chart_count`, `column_count`, `row_count` |
| `qa_query` | `text` | `[]` | `question_length`, `columns_referenced`, `history_turns` |
