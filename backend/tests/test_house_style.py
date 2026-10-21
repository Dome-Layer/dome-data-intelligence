"""House style: no em or en dashes in the backend or in what the model writes.

The source scan keeps the dashes out of prompts (they nudge the model into
writing them) and out of messages users read. The other tests pin down the
post-processing applied to the Q&A answer and the column notes.
"""

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.house_style import strip_dashes
from app.core.prompts import CLASSIFIER_SYSTEM_PROMPT, QA_SYSTEM_PROMPT
from app.main import app
from app.services.classifier import classify_columns
from tests.test_pipeline import _TEST_SESSION_ID, MOCK_CLASSIFICATIONS, SAMPLE_COLUMN_SUMMARY

EM = "\N{EM DASH}"
EN = "\N{EN DASH}"

BACKEND = Path(__file__).resolve().parents[1]
SCANNED_FILES = sorted((BACKEND / "app").rglob("*.py"))

client = TestClient(app)


def test_no_dashes_in_backend_source():
    offenders = [
        f"{path.relative_to(BACKEND)}:{number}"
        for path in SCANNED_FILES
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1)
        if EM in line or EN in line
    ]
    assert not offenders, "Em or en dash found (house style):\n" + "\n".join(offenders)


@pytest.mark.parametrize("prompt", [CLASSIFIER_SYSTEM_PROMPT, QA_SYSTEM_PROMPT])
def test_prompts_ask_for_no_dashes(prompt):
    assert "Never use the em dash or the en dash" in prompt


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (f"Revenue peaked in March {EM} up 12%.", "Revenue peaked in March, up 12%."),
        (f"EMEA{EM}APAC", "EMEA, APAC"),
        (f"rows 10{EN}20", "rows 10-20"),
        (f"{EM} first\n{EM} second", "- first\n- second"),
        (EM, "N/A"),
        ("plain text, untouched", "plain text, untouched"),
        (f"(`a`, ...) {EM} then", "(`a`, ...), then"),
    ],
)
def test_strip_dashes(raw, expected):
    assert strip_dashes(raw) == expected


@patch("app.api.qa.get_supabase_client", return_value=None)
@patch("app.api.qa.get_llm_provider")
def test_qa_answer_is_cleaned(mock_provider_factory, _mock_db):
    mock_llm = MagicMock()
    mock_llm.answer_question = AsyncMock(
        return_value={
            "answer": f"March {EM} the peak month.",
            "columns_referenced": ["Date"],
            "confidence": 0.9,
        }
    )
    mock_provider_factory.return_value = mock_llm

    response = client.post(
        "/api/v1/qa",
        json={
            "session_id": _TEST_SESSION_ID,
            "question": "Which month peaked?",
            "conversation_history": [],
            "column_summary": SAMPLE_COLUMN_SUMMARY,
            "classifications": [c.model_dump() for c in MOCK_CLASSIFICATIONS],
        },
    )
    assert response.status_code == 200
    assert response.json()["answer"] == "March, the peak month."


def test_classification_notes_are_cleaned():
    noted = MOCK_CLASSIFICATIONS[0].model_copy(update={"note": f"quarterly labels {EM} not dates"})
    provider = MagicMock()
    provider.classify_columns = AsyncMock(return_value=[noted, MOCK_CLASSIFICATIONS[1]])

    result = asyncio.run(classify_columns(provider, []))
    assert result[0].note == "quarterly labels, not dates"
    assert result[1] == MOCK_CLASSIFICATIONS[1]
