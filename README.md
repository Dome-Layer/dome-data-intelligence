# Dome Data Intelligence

*Upload any CSV or Excel file — get a governed analytics dashboard with natural language Q&A in seconds. Raw data never leaves your browser.*

Part of the Dome portfolio. For full tool specification see [`TOOL_CONTEXT.md`](./TOOL_CONTEXT.md). For cross-cutting Dome context see [dome-docs](../dome-docs/).

---

## Quick start

### Requirements
- Python 3.12
- Node.js 20+

### Setup

```bash
# Clone
git clone https://github.com/dome-layer/dome-data-intelligence.git
cd dome-data-intelligence

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit backend/.env — set LLM_PROVIDER and ANTHROPIC_API_KEY at minimum

# Frontend
cd ../frontend
npm install
cp .env.example .env
# Edit frontend/.env — set NEXT_PUBLIC_API_BASE=http://localhost:8000
```

### Run locally

```bash
# Backend (from backend/)
uvicorn app.main:app --reload --port 8000

# Frontend (from frontend/, in a second terminal)
npm run dev
```

Visit `http://localhost:3000`. Three preloaded demo datasets are available on the home page — no file upload needed to try the tool.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `LLM_PROVIDER` | Yes | `claude` / `azure_openai` / `ollama` |
| `ANTHROPIC_API_KEY` | For `claude` | Anthropic API key |
| `AZURE_OPENAI_ENDPOINT` | For `azure_openai` | Azure OpenAI endpoint |
| `AZURE_OPENAI_KEY` | For `azure_openai` | Azure OpenAI key |
| `AZURE_OPENAI_DEPLOYMENT` | For `azure_openai` | Deployment name |
| `OLLAMA_URL` | For `ollama` | Ollama server URL (default `http://localhost:11434`) |
| `SUPABASE_URL` | Optional | Shared DOME Platform Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase service role key |
| `API_KEY` | Optional | Shared key required in `X-API-Key` header (leave empty to disable in dev) |
| `SESSION_SIGNING_SECRET` | Optional | HMAC secret for session IDs — generate with `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | Yes | CORS origins, comma-separated |
| `ENVIRONMENT` | Yes | `development` / `production` |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | Yes | Backend URL — **no** `/api/v1` suffix (e.g. `http://localhost:8000`) |
| `NEXT_PUBLIC_API_KEY` | Optional | Matches backend `API_KEY` — leave empty for local dev |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Shared DOME Platform Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase anon key |
| `NEXT_PUBLIC_AUTH_BACKEND` | Optional | Shared auth backend URL for SSO cookie validation |
| `NEXT_PUBLIC_SITE_URL` | Optional | Public URL of this app (used in auth redirects) |

Never commit real secrets. `.env` files are gitignored; `.env.example` files are not.

---

## Deployment

### Cloud demo
- **Frontend:** Vercel → `https://data-intelligence.domelayer.com`
- **Backend:** Railway (root directory: `backend/`) → `https://api.domelayer.com`
- **Key gotcha:** Set `NEXT_PUBLIC_API_BASE` to `https://api.domelayer.com` with no `/api/v1` suffix. Railway injects `PORT` at runtime; the Dockerfile CMD uses `${PORT:-8000}`.

### Client Azure tenant
`LLM_PROVIDER=azure_openai` — the `AzureOpenAIProvider` stub exists but is not yet implemented. See [`TOOL_CONTEXT.md`](./TOOL_CONTEXT.md) for details.

### Air-gapped
`LLM_PROVIDER=ollama` — the `OllamaProvider` stub exists but is not yet implemented. See [`TOOL_CONTEXT.md`](./TOOL_CONTEXT.md) for details.

---

## Repository structure

```
dome-data-intelligence/
├── TOOL_CONTEXT.md              Full tool specification (read this first)
├── README.md                    This file
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI app entry point
│   │   ├── api/                 upload.py, dashboard.py, qa.py
│   │   ├── core/                config.py, prompts.py, logging.py, db.py
│   │   ├── models/schemas.py    All Pydantic models
│   │   ├── providers/           LLMProvider ABC + Claude/Azure/Ollama implementations
│   │   └── services/            parser.py, classifier.py, rules_engine.py, governance.py
│   ├── tests/test_pipeline.py   18 smoke tests (mocked LLM + Supabase)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/                     Next.js app router pages
│   ├── components/              dashboard/, qa/, upload/, layout/, ui/
│   ├── lib/                     api.ts, types.ts, fileParser.ts, dataContext.ts
│   ├── public/demo/             Three preloaded demo CSV files
│   └── .env.example
└── docker-compose.yml
```

---

## Related

- [dome-docs](../dome-docs/) — cross-cutting Dome documentation
- [`TOOL_CONTEXT.md`](./TOOL_CONTEXT.md) — full specification for this tool
- [Portfolio status](../dome-docs/PORTFOLIO_STATUS.md)
