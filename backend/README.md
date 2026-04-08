# Dome Data Intelligence — Backend

Python 3.12 · FastAPI · Anthropic Claude API

## Overview

Stateless FastAPI backend. Receives column summaries from the browser, classifies columns via LLM, runs a deterministic rules engine to select chart types, and answers natural language questions about the dataset. Raw file data never reaches the server.

## Stack

| Concern | Library |
|---|---|
| Framework | FastAPI |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) via `anthropic` SDK |
| LLM abstraction | `LLMProvider` ABC — swap Claude / Azure OpenAI / Ollama via env var |
| Settings | pydantic-settings |
| Logging | structlog (JSON in production, console in dev) |
| Database | Supabase (optional — all endpoints degrade gracefully without it) |
| Tests | pytest + pytest-asyncio |

## Getting Started

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # set LLM_PROVIDER and ANTHROPIC_API_KEY at minimum
uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/api/v1/health` → `{"status":"ok","version":"1.0.0"}`

Interactive docs (dev only): `http://localhost:8000/docs`

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LLM_PROVIDER` | Yes | `claude` / `azure_openai` / `ollama` |
| `ANTHROPIC_API_KEY` | If `claude` | Anthropic API key |
| `AZURE_OPENAI_ENDPOINT` | If `azure_openai` | Azure OpenAI endpoint |
| `AZURE_OPENAI_KEY` | If `azure_openai` | Azure OpenAI key |
| `AZURE_OPENAI_DEPLOYMENT` | If `azure_openai` | Deployment name |
| `OLLAMA_URL` | If `ollama` | Ollama server URL (default: `http://localhost:11434`) |
| `SUPABASE_URL` | No | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | No | Supabase service role key |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (default: `http://localhost:3000`) |
| `ENVIRONMENT` | No | `development` / `production` (default: `development`) |

## Project Structure

```
backend/
├── app/
│   ├── main.py                     # FastAPI app, CORS middleware, router mounts, /health
│   ├── api/
│   │   ├── upload.py               # POST /api/v1/upload
│   │   ├── dashboard.py            # POST /api/v1/dashboard
│   │   └── qa.py                   # POST /api/v1/qa
│   ├── core/
│   │   ├── config.py               # Settings (pydantic-settings), LLMProvider factory
│   │   ├── prompts.py              # CLASSIFIER_SYSTEM_PROMPT, QA_SYSTEM_PROMPT
│   │   ├── logging.py              # structlog setup
│   │   └── db.py                   # Supabase client (returns None if not configured)
│   ├── models/
│   │   └── schemas.py              # All Pydantic models
│   ├── providers/
│   │   ├── base.py                 # LLMProvider ABC
│   │   ├── claude.py               # ClaudeProvider (full — with retry logic)
│   │   ├── azure_openai.py         # AzureOpenAIProvider (stub)
│   │   └── ollama.py               # OllamaProvider (stub)
│   └── services/
│       ├── parser.py               # Column summary validation
│       ├── classifier.py           # LLM column classification
│       ├── rules_engine.py         # Deterministic R-01 through R-07
│       └── governance.py           # GovernanceEvent construction + structlog emission
├── tests/
│   └── test_pipeline.py            # 18 smoke tests (mocked LLM + Supabase)
├── Dockerfile
├── requirements.txt
└── .env.example
```

## API Endpoints

### `POST /api/v1/upload`
Receives column summary (JSON, no file binary). Validates shape, assigns `session_id`, persists to Supabase if configured. Returns `session_id` + echo of column summary.

### `POST /api/v1/dashboard`
Classifies columns via LLM, runs rules engine (R-01–R-07), builds GovernanceEvent, returns dashboard config. Supabase is used for session lookup when configured; endpoint functions without it.

### `POST /api/v1/qa`
Answers natural language questions. Accepts inline `column_summary`, `classifications`, and `data_context` fields so it functions without Supabase. Falls back to Supabase lookup only when inline data is absent. Full `conversation_history` sent by client on every request (stateless).

### `GET /api/v1/health`
Returns `{"status":"ok","version":"1.0.0"}`. Also accepts `HEAD`.

## Chart Rules Engine

| Rule | Condition | Chart Type |
|---|---|---|
| R-01 | `date` column + metric | Line chart |
| R-02 | `category` (≤20 unique) + metric | Bar chart |
| R-03 | metric column (any) | KPI card |
| R-04 | metric (>20 unique values) | Histogram |
| R-05 | `category` (≤8 unique) + metric | Donut chart |
| R-06 | always | Summary table |
| R-07 | two metric columns | Scatter plot |

`ordered_category` columns are intentionally excluded from R-01 — quarterly/monthly string labels must not generate line charts.

## LLM Retry Logic

`ClaudeProvider` retries on transient errors (HTTP 529 overloaded, 500, 502, 503, 504, connection errors) with exponential backoff: up to 3 attempts at 2 s → 4 s → 8 s delays. Non-retryable errors (400, 401, 422) are raised immediately.

## Q&A Data Context

The frontend computes aggregations from raw rows client-side (`lib/dataContext.ts`) and sends them as a `data_context` string in the request body. The backend injects this into the system prompt so the LLM can answer precise quantitative questions (totals, breakdowns by category, monthly sums) without access to raw data.

## Supabase Schema

```sql
create table sessions (
  session_id       uuid primary key,
  filename         text,
  row_count        integer,
  column_summary   jsonb,
  classifications  jsonb,
  charts           jsonb,
  user_id          uuid references auth.users,
  created_at       timestamptz default now()
);
```

All Supabase operations are wrapped in try/except — the app degrades gracefully to stateless operation when the database is unavailable or not configured.

## Tests

```bash
python3 -m pytest tests/ -q
```

18 tests covering: health, upload (happy path, 413, empty, clamping), dashboard pipeline (mocked LLM + Supabase), governance shape, all 7 rules engine cases (including `ordered_category` → R-01 skip), Q&A happy path + empty-question rejection, parser unit tests.

## Deployment (Railway)

1. Root directory: `backend/`
2. Build: Dockerfile (python:3.12-slim)
3. Start command: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Required env vars: `LLM_PROVIDER=claude`, `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS=https://data.domelayer.com`
5. Confirm: `GET https://<railway-url>/api/v1/health` returns `{"status":"ok"}`
