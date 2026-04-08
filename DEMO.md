# Dome Data Intelligence — Demo Guide

## Prerequisites

- Python 3.12
- Node.js 18+
- A `.env` file in `backend/` with `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_KEY`

---

## Start the Backend

```bash
cd backend
python3 -m uvicorn app.main:app --reload
```

API docs available at: `http://localhost:8000/docs`

---

## Start the Frontend

```bash
cd frontend
npm run dev
```

App available at: `http://localhost:3000`

---

## Demo Story

**Scenario:** An IT Finance analyst receives a budget-vs-actuals spreadsheet and wants instant insights without sharing raw data with any external service.

1. **Open the app** at `http://localhost:3000`.
2. **Upload `it_budget_vs_actuals.csv`** (located in the project root). The file is parsed entirely in the browser — no raw rows leave your machine.
3. **Inspect the dashboard.** The backend classifies each column (department, budget, actuals, variance) and the rules engine selects appropriate chart types. A bar chart comparing budget vs. actuals and a variance trend line appear automatically.
4. **Check the Governance panel.** Every classification and chart-selection decision is logged as a `GovernanceEvent` and displayed alongside the dashboard — fully auditable, no black box.
5. **Ask a question.** Type into the Q&A panel:
   > "Which department has the largest budget overrun?"

   The assistant answers using only the column summary and classifications — never the raw rows.
6. **Try a second dataset.** Upload `procurement_spend_by_supplier.csv` to see supplier-spend charts generated from a completely different schema — same pipeline, different output.

---

## Preloaded Demo Datasets

| File | Domain |
|------|--------|
| `it_budget_vs_actuals.csv` | IT Finance |
| `procurement_spend_by_supplier.csv` | Procurement Spend |
| `commodity_position_report.csv` | Commodity Trade Finance |
