# Dome Data Intelligence — Project Plan

## Overview

Dome Data Intelligence (P3) is a spreadsheet analytics tool that converts uploaded files into governed dashboards with natural language Q&A. It demonstrates the Orchestrate & Model phases of the DOME method.

A user uploads any CSV, XLSX, or XLS file. The browser parses it locally, extracts a column summary, and sends only that summary to the backend. The backend classifies columns via LLM, runs a deterministic rules engine to select chart types, and returns a dashboard configuration. The frontend renders charts using Recharts. A Q&A panel allows natural language queries against the column summary and classifications. Raw data never leaves the browser.

**Live demo:** domelayer.com (three preloaded demo datasets)
**Target users:** IT Finance analysts, Commodity Trade Finance teams, procurement spend analysts

---

## Portfolio Position

| # | Project | DOME Phase | Status |
|---|---|---|---|
| 1 | Dome Process Analyzer | Discover | Built |
| **3** | **Dome Data Intelligence** | **Orchestrate & Model** | **This project** |
| 2 | Dome Document Intelligence | Orchestrate & Model | Planned |
| 4 | Dome Morning Intelligence | Execute | Planned |
| 5 | Dome Governance Dashboard | Governance Layer | Planned |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend language | Python 3.12 |
| Backend framework | FastAPI |
| Backend hosting | Railway |
| File parsing (server) | pandas |
| File parsing (client) | PapaParse (CSV), SheetJS (XLSX/XLS) |
| Frontend framework | Next.js 14 + TypeScript (strict) |
| Frontend hosting | Vercel |
| Styling | Tailwind CSS + Dome design tokens |
| Charts | Recharts |
| LLM | Claude API via LLMProvider abstraction |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (magic link) |

---

## Architecture Principles

1. **LLM classifies, rules engine decides.** The LLM receives column names, dtypes, sample values, and aggregates only — never raw rows. It returns a classification per column. A deterministic rules engine maps those classifications to chart types. Chart selection is auditable and reproducible.

2. **Zero retention.** Raw file data never reaches the server. The browser parses the file, extracts the column summary, and sends only the summary to `/api/v1/upload`. Raw rows are held in React state for the duration of the browser session only. When the tab closes, the data is gone. The governance log records this explicitly.

3. **LLMProvider abstraction.** All LLM calls go through the `LLMProvider` ABC. Provider is selected via `LLM_PROVIDER` environment variable. No business logic references a specific provider directly. Supports three deployment modes: Cloud Demo (Claude API), Client Azure Tenant (Azure OpenAI), Air-Gapped (Ollama + Llama).

4. **GovernanceEvent on every action.** Every dashboard generation and every Q&A query emits a structured `GovernanceEvent`. Events are logged server-side (metadata only, no content). The governance object is also returned in every API response for frontend display.

5. **Stateless Q&A.** The backend holds no conversation state between Q&A turns. The frontend sends the full `conversation_history` with every `/qa` request.

---

## Chart Rules Engine

| Rule | Condition | Chart Type |
|---|---|---|
| R-01 | date column + metric column | Line chart |
| R-02 | category column (≤20 unique) + metric column | Bar chart |
| R-03 | metric column only | KPI card |
| R-04 | metric column (>20 unique values) | Histogram |
| R-05 | category column (≤8 unique) + metric column | Donut chart |
| R-06 | always | Summary table (top 20 rows) |
| R-07 | two metric columns | Scatter plot |

**Column types (LLM classification output):**
- `date` — ISO date strings
- `ordered_category` — categorical with natural order (Q1/Q2/Q3, Jan/Feb/Mar) — R-01 does NOT fire
- `category` — unordered categorical
- `metric` — numeric, continuous or discrete

---

## Demo Datasets

Three preloaded datasets cover all seven rules and surface key edge cases:

| Dataset | Rows | Rules Fired | Edge Case |
|---|---|---|---|
| Commodity Position Report | 28 | R-01 R-02×2 R-03 R-05 R-06 R-07 | Signed metrics (net short = negative) |
| IT Budget vs Actuals | 96 | R-02×2 R-03 R-05 R-06 R-07 | `Period` = ordered_category, R-01 skips |
| Procurement Spend by Supplier | 135 | R-02×3 R-03 R-05 R-06 R-07 | `Month` = ordered_category, R-01 skips |

Demo files are served from `frontend/public/demo/`. The browser fetches, parses, and feeds them through the same upload flow as user files. No special backend handling.

---

## Folder Structure

```
dome-data-intelligence/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── upload.py
│   │   │   ├── dashboard.py
│   │   │   └── qa.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── prompts.py
│   │   │   ├── logging.py
│   │   │   └── db.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py
│   │   ├── providers/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── claude.py
│   │   │   ├── azure_openai.py
│   │   │   └── ollama.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── parser.py
│   │       ├── classifier.py
│   │       ├── rules_engine.py
│   │       └── governance.py
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_pipeline.py
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── dashboard/
│   │       └── [sessionId]/
│   │           └── page.tsx
│   ├── components/
│   │   ├── upload/
│   │   │   ├── DropZone.tsx
│   │   │   └── UploadProgress.tsx
│   │   ├── dashboard/
│   │   │   ├── DashboardGrid.tsx
│   │   │   ├── KPICard.tsx
│   │   │   ├── LineChart.tsx
│   │   │   ├── BarChart.tsx
│   │   │   ├── DonutChart.tsx
│   │   │   ├── ScatterPlot.tsx
│   │   │   ├── Histogram.tsx
│   │   │   ├── SummaryTable.tsx
│   │   │   └── DataTable.tsx
│   │   ├── qa/
│   │   │   ├── QAPanel.tsx
│   │   │   └── QAMessage.tsx
│   │   └── ui/
│   │       ├── GovernanceBadge.tsx
│   │       └── RuleBadge.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── types.ts
│   │   └── fileParser.ts
│   ├── styles/
│   │   └── globals.css
│   ├── public/
│   │   ├── demo/
│   │   │   ├── commodity_position_report.csv
│   │   │   ├── it_budget_vs_actuals.csv
│   │   │   └── procurement_spend_by_supplier.csv
│   │   └── dome-logo.svg
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── .env.example
│   └── README.md
│
├── PROJECT_PLAN.md
├── TECHNICAL_SPEC.md
├── SESSION_LOG.md
└── docker-compose.yml
```

---

## Build Sequence

### Session 1 — Backend Core
- Scaffold FastAPI app, folder structure, Dockerfile
- `schemas.py` — all Pydantic models
- `config.py` — settings, LLMProvider factory
- `providers/` — base ABC + ClaudeProvider (full), Azure + Ollama stubs
- `services/parser.py` — column summary extraction from pandas DataFrame
- `services/classifier.py` — LLM column classification via provider
- `services/rules_engine.py` — deterministic R-01 through R-07
- `services/governance.py` — GovernanceEvent construction
- `api/upload.py`, `api/dashboard.py`, `api/qa.py` — three endpoints
- `tests/test_pipeline.py` — smoke tests (mocked LLM)
- Deploy to Railway

### Session 2 — Frontend Core
- Scaffold Next.js app, Tailwind config, Dome design tokens
- `lib/fileParser.ts` — PapaParse + SheetJS, column summary extraction
- `lib/types.ts` — TypeScript types mirroring all Pydantic models
- `lib/api.ts` — typed fetch wrappers
- `components/upload/` — DropZone, UploadProgress
- `app/page.tsx` — upload screen with demo dataset buttons
- Deploy to Vercel

### Session 3 — Dashboard Charts
- `components/dashboard/` — all chart components (Recharts, Dome-styled)
- `components/ui/` — GovernanceBadge, RuleBadge
- `app/dashboard/[sessionId]/page.tsx` — full dashboard layout
- `DashboardGrid.tsx` — chart layout orchestration

### Session 4 — Q&A Panel + Data Table
- `components/qa/` — QAPanel, QAMessage
- `components/dashboard/DataTable.tsx` — raw row viewer, pagination, column highlight
- Wire Q&A to `/api/v1/qa`
- Column highlighting between DataTable and active chart

### Session 5 — Auth + Persistence + Polish
- Supabase Auth (magic link)
- Save/load dashboard configs
- GovernanceBadge wired to live governance data
- Demo dataset flow end-to-end test
- Production smoke test

---

## Environment Variables

### Backend
| Variable | Description |
|---|---|
| `LLM_PROVIDER` | `claude` / `azure_openai` / `ollama` |
| `ANTHROPIC_API_KEY` | Claude API key (cloud demo) |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint (enterprise) |
| `AZURE_OPENAI_KEY` | Azure OpenAI key (enterprise) |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name (enterprise) |
| `OLLAMA_URL` | Ollama server URL (air-gapped) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) |
| `ENVIRONMENT` | `development` / `production` |

### Frontend
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE` | Backend URL (Railway) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

---

## Monthly Cost Estimate (Cloud Demo)

| Service | Cost |
|---|---|
| Railway (backend) | ~€5 |
| Vercel (frontend) | Free (hobby) |
| Supabase (DB + Auth) | Free tier |
| Claude API (demo usage) | ~€3–5 |
| **Total** | **~€8–10/month** |
