"""Smoke tests for the Dome Data Intelligence pipeline.

LLM calls are mocked throughout — these tests validate the full HTTP → service
→ rules-engine pipeline without hitting any external API.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import ColumnClassification, ColumnType

client = TestClient(app)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_COLUMN_SUMMARY = [
    {
        "name": "Date",
        "dtype": "object",
        "unique_count": 12,
        "null_count": 0,
        "sample_values": ["2024-01-01", "2024-02-01", "2024-03-01"],
        "min": None,
        "max": None,
        "mean": None,
    },
    {
        "name": "Revenue",
        "dtype": "float64",
        "unique_count": 12,
        "null_count": 0,
        "sample_values": ["100000.0", "120000.0", "95000.0"],
        "min": 80000.0,
        "max": 150000.0,
        "mean": 112000.0,
    },
    {
        "name": "Region",
        "dtype": "object",
        "unique_count": 4,
        "null_count": 0,
        "sample_values": ["EMEA", "APAC", "Americas"],
        "min": None,
        "max": None,
        "mean": None,
    },
]

MOCK_CLASSIFICATIONS = [
    ColumnClassification(
        column_name="Date",
        classified_type=ColumnType.date,
        unique_count=12,
        can_be_negative=False,
        is_ordinal=False,
        unit=None,
        note=None,
    ),
    ColumnClassification(
        column_name="Revenue",
        classified_type=ColumnType.metric,
        unique_count=12,
        can_be_negative=False,
        is_ordinal=False,
        unit="EUR",
        note=None,
    ),
    ColumnClassification(
        column_name="Region",
        classified_type=ColumnType.category,
        unique_count=4,
        can_be_negative=False,
        is_ordinal=False,
        unit=None,
        note=None,
    ),
]


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health_get():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_head():
    response = client.head("/api/v1/health")
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

def test_upload_returns_201():
    response = client.post("/api/v1/upload", json={
        "filename": "test.csv",
        "row_count": 12,
        "column_summary": SAMPLE_COLUMN_SUMMARY,
    })
    assert response.status_code == 201
    data = response.json()
    assert "session_id" in data
    assert data["column_count"] == 3
    assert data["filename"] == "test.csv"
    assert data["row_count"] == 12
    assert isinstance(data["parse_warnings"], list)


def test_upload_rejects_oversized():
    response = client.post("/api/v1/upload", json={
        "filename": "big.csv",
        "row_count": 100_000,
        "column_summary": SAMPLE_COLUMN_SUMMARY,
    })
    assert response.status_code == 413


def test_upload_rejects_empty_column_summary():
    response = client.post("/api/v1/upload", json={
        "filename": "empty.csv",
        "row_count": 10,
        "column_summary": [],
    })
    assert response.status_code == 422


def test_upload_clamps_null_count():
    col = dict(SAMPLE_COLUMN_SUMMARY[0])
    col["null_count"] = 9999  # exceeds row_count
    response = client.post("/api/v1/upload", json={
        "filename": "test.csv",
        "row_count": 12,
        "column_summary": [col] + SAMPLE_COLUMN_SUMMARY[1:],
    })
    assert response.status_code == 201
    data = response.json()
    assert len(data["parse_warnings"]) > 0


# ---------------------------------------------------------------------------
# Dashboard (mocked LLM + mocked DB)
# ---------------------------------------------------------------------------

@patch("app.api.dashboard.get_supabase_client")
@patch("app.api.dashboard.get_llm_provider")
def test_dashboard_pipeline(mock_provider_factory, mock_db_factory):
    mock_db_factory.return_value = None  # No Supabase

    mock_llm = MagicMock()
    mock_llm.classify_columns = AsyncMock(return_value=MOCK_CLASSIFICATIONS)
    mock_provider_factory.return_value = mock_llm

    response = client.post("/api/v1/dashboard", json={
        "session_id": "test-session-123",
        "column_summary": SAMPLE_COLUMN_SUMMARY,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "test-session-123"
    assert len(data["classifications"]) == 3
    assert len(data["charts"]) > 0
    assert "governance" in data

    rule_ids = {c["rule_id"] for c in data["charts"]}
    assert "R-01" in rule_ids   # date + metric
    assert "R-02" in rule_ids   # category + metric
    assert "R-03" in rule_ids   # KPI
    assert "R-06" in rule_ids   # always fires


@patch("app.api.dashboard.get_supabase_client")
@patch("app.api.dashboard.get_llm_provider")
def test_dashboard_governance_shape(mock_provider_factory, mock_db_factory):
    mock_db_factory.return_value = None
    mock_llm = MagicMock()
    mock_llm.classify_columns = AsyncMock(return_value=MOCK_CLASSIFICATIONS)
    mock_provider_factory.return_value = mock_llm

    response = client.post("/api/v1/dashboard", json={
        "session_id": "gov-test",
        "column_summary": SAMPLE_COLUMN_SUMMARY,
    })
    gov = response.json()["governance"]
    assert gov["agent_id"] == "data-intelligence"
    assert gov["action_type"] == "dashboard_generation"
    assert gov["input_type"] == "spreadsheet"
    assert isinstance(gov["rules_triggered"], list)
    assert "R-06" in gov["rules_triggered"]
    assert "workflow_run_id" in gov
    assert gov["workflow_run_id"] is None


# ---------------------------------------------------------------------------
# Rules engine (unit tests — no HTTP)
# ---------------------------------------------------------------------------

def test_rules_engine_r01_fires_on_date_and_metric():
    from app.services.rules_engine import fire_rules
    charts = fire_rules(MOCK_CLASSIFICATIONS)
    assert any(c.rule_id == "R-01" for c in charts)


def test_rules_engine_r06_always_fires():
    from app.services.rules_engine import fire_rules
    charts = fire_rules([])
    assert any(c.rule_id == "R-06" for c in charts)


def test_rules_engine_r07_requires_two_metrics():
    from app.services.rules_engine import fire_rules

    one_metric = [MOCK_CLASSIFICATIONS[1]]  # Revenue only
    assert not any(c.rule_id == "R-07" for c in fire_rules(one_metric))

    two_metrics = [
        ColumnClassification(
            column_name="Revenue", classified_type=ColumnType.metric,
            unique_count=50, can_be_negative=False, is_ordinal=False,
        ),
        ColumnClassification(
            column_name="Cost", classified_type=ColumnType.metric,
            unique_count=50, can_be_negative=False, is_ordinal=False,
        ),
    ]
    assert any(c.rule_id == "R-07" for c in fire_rules(two_metrics))


def test_rules_engine_ordered_category_skips_r01():
    """ordered_category must NOT trigger R-01 (line chart)."""
    from app.services.rules_engine import fire_rules
    from app.models.schemas import ColumnType

    cols = [
        ColumnClassification(
            column_name="Period", classified_type=ColumnType.ordered_category,
            unique_count=12, can_be_negative=False, is_ordinal=True,
        ),
        ColumnClassification(
            column_name="Revenue", classified_type=ColumnType.metric,
            unique_count=12, can_be_negative=False, is_ordinal=False,
        ),
    ]
    charts = fire_rules(cols)
    assert not any(c.rule_id == "R-01" for c in charts)


def test_rules_engine_r05_only_for_le_8_unique():
    from app.services.rules_engine import fire_rules

    cols = [
        ColumnClassification(
            column_name="Status", classified_type=ColumnType.category,
            unique_count=3, can_be_negative=False, is_ordinal=False,
        ),
        ColumnClassification(
            column_name="BigCat", classified_type=ColumnType.category,
            unique_count=15, can_be_negative=False, is_ordinal=False,
        ),
        ColumnClassification(
            column_name="Revenue", classified_type=ColumnType.metric,
            unique_count=50, can_be_negative=False, is_ordinal=False,
        ),
    ]
    charts = fire_rules(cols)
    donut_x_cols = [c.x_column for c in charts if c.rule_id == "R-05"]
    assert "Status" in donut_x_cols
    assert "BigCat" not in donut_x_cols


def test_rules_engine_r04_histogram_for_high_unique_metric():
    from app.services.rules_engine import fire_rules

    cols = [
        ColumnClassification(
            column_name="Price", classified_type=ColumnType.metric,
            unique_count=100, can_be_negative=False, is_ordinal=False,
        ),
    ]
    charts = fire_rules(cols)
    assert any(c.rule_id == "R-04" for c in charts)


# ---------------------------------------------------------------------------
# Q&A (mocked LLM + mocked DB)
# ---------------------------------------------------------------------------

@patch("app.api.qa.get_supabase_client")
@patch("app.api.qa.get_llm_provider")
def test_qa_returns_200(mock_provider_factory, mock_db_factory):
    mock_db_factory.return_value = None

    mock_llm = MagicMock()
    mock_llm.answer_question = AsyncMock(return_value={
        "answer": "Revenue peaked in March at €150,000.",
        "columns_referenced": ["Revenue", "Date"],
        "confidence": 0.92,
    })
    mock_provider_factory.return_value = mock_llm

    response = client.post("/api/v1/qa", json={
        "session_id": "test-session-123",
        "question": "Which month had the highest revenue?",
        "conversation_history": [],
    })
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "governance" in data
    assert data["governance"]["action_type"] == "qa_query"


def test_qa_rejects_empty_question():
    response = client.post("/api/v1/qa", json={
        "session_id": "test-session-123",
        "question": "   ",
        "conversation_history": [],
    })
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Parser service (unit tests)
# ---------------------------------------------------------------------------

def test_parser_truncates_sample_values():
    from app.services.parser import validate_column_summary
    from app.models.schemas import ColumnSummary

    col = ColumnSummary(
        name="X", dtype="object", unique_count=20, null_count=0,
        sample_values=[str(i) for i in range(15)],
    )
    cleaned, warnings = validate_column_summary([col], row_count=100)
    assert len(cleaned[0].sample_values) == 10
    assert any("truncated" in w for w in warnings)


def test_parser_clamps_null_count():
    from app.services.parser import validate_column_summary
    from app.models.schemas import ColumnSummary

    col = ColumnSummary(
        name="X", dtype="object", unique_count=5, null_count=200,
        sample_values=["a"],
    )
    cleaned, warnings = validate_column_summary([col], row_count=100)
    assert cleaned[0].null_count == 100
    assert any("null_count" in w for w in warnings)
