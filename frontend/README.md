# Dome Data Intelligence — Frontend

Next.js 14 · TypeScript (strict) · Tailwind CSS · Recharts

## Overview

Browser-based analytics dashboard. The user uploads any CSV or Excel file; the browser parses it locally, extracts a column summary, and sends only that summary to the backend. Raw rows never leave the browser. The backend classifies columns via LLM and returns a dashboard configuration. The frontend renders charts and provides a Q&A panel backed by pre-computed aggregations.

## Stack

| Concern | Library |
|---|---|
| Framework | Next.js 14.2 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + Dome design tokens |
| Charts | Recharts 2 |
| CSV parsing | PapaParse 5 |
| Excel parsing | SheetJS (xlsx 0.18.5 — last Apache 2.0 release) |

## Getting Started

```bash
cd frontend
npm install
cp .env.example .env          # set NEXT_PUBLIC_API_BASE
npm run dev                   # http://localhost:3000
```

Make sure the backend is running on the URL set in `NEXT_PUBLIC_API_BASE` (default: `http://localhost:8000`).

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE` | Backend URL (Railway in production, `http://localhost:8000` in dev) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (optional until Session 5) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (optional until Session 5) |

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx                  # Root layout — Inter + JetBrains Mono fonts, global Header + Footer
│   ├── page.tsx                    # Upload screen with demo dataset buttons
│   └── dashboard/[sessionId]/
│       └── page.tsx                # Dashboard page — charts, data table, Q&A
├── components/
│   ├── layout/
│   │   ├── Header.tsx              # Sticky branded header — logo aligned with page content
│   │   ├── Footer.tsx              # Footer with Dome attribution and "Explore Dome" link
│   │   └── DomeLogo.tsx            # Official DOME SVG wordmark (#0080FF)
│   ├── dashboard/
│   │   ├── DashboardGrid.tsx       # Chart layout orchestrator (KPI row + 2-col grid + table)
│   │   ├── KPICard.tsx             # R-03 — metric KPI with Total / Avg / Min / Max
│   │   ├── LineChart.tsx           # R-01 — trend over time
│   │   ├── BarChart.tsx            # R-02 — category comparison (max 20 bars)
│   │   ├── DonutChart.tsx          # R-05 — part-of-whole breakdown
│   │   ├── Histogram.tsx           # R-04 — value distribution (10 bins)
│   │   ├── ScatterPlot.tsx         # R-07 — correlation (max 8 colour groups)
│   │   ├── SummaryTable.tsx        # R-06 — top 20 rows preview
│   │   ├── DataTable.tsx           # Full raw-data browser (50-row pagination, sort, highlight, CSV export)
│   │   ├── EmptyChart.tsx          # Empty state placeholder
│   │   └── types.ts                # Shared chart types, palette, formatters
│   ├── qa/
│   │   ├── QAPanel.tsx             # Fixed sidebar (desktop) / bottom sheet (mobile)
│   │   └── QAMessage.tsx           # User / assistant message bubbles
│   ├── ui/
│   │   ├── GovernanceBadge.tsx     # Governance event card
│   │   └── RuleBadge.tsx           # Human-readable chart rule badge (e.g. "Bar chart R-02")
│   └── upload/
│       ├── DropZone.tsx            # Drag-and-drop + file picker
│       └── UploadProgress.tsx      # 4-step pipeline indicator
├── lib/
│   ├── api.ts                      # Typed fetch wrappers for /upload, /dashboard, /qa
│   ├── dataContext.ts              # Client-side aggregation engine (totals, breakdowns, monthly)
│   ├── fileParser.ts               # PapaParse + SheetJS parser; merges compatible Excel sheets
│   └── types.ts                    # TypeScript types mirroring all Pydantic schemas
├── styles/
│   └── globals.css                 # Tailwind base + governance-banner utility
├── public/
│   ├── demo/                       # Three preloaded demo CSV datasets
│   └── dome-logo.svg
├── tailwind.config.ts              # Dome design tokens (light theme)
├── next.config.mjs
└── tsconfig.json
```

## Key Behaviours

### File Parsing (`lib/fileParser.ts`)
- CSV: parsed by PapaParse with `dynamicTyping: true`
- Excel: parsed by SheetJS with `cellDates: true` — date serials are converted to `YYYY-MM-DD` strings using local date parts (not UTC, to avoid timezone off-by-one)
- Multi-tab Excel: all sheets with the same column schema are merged into one dataset; incompatible sheets are skipped and the user is notified via a banner on the dashboard
- Sheet selection uses local date parts to avoid UTC off-by-one

### Data Context (`lib/dataContext.ts`)
Runs entirely in the browser on the raw rows. Computes:
- Total per metric column
- Metric × category breakdowns (sorted by value descending, max 50 groups)
- Metric × month from date columns
- Metric × month × category (three-way, for categories with ≤20 unique values)

This pre-computed context is sent with every Q&A request so the LLM can answer precise quantitative questions ("total hours in January", "breakdown by client") without access to raw rows.

### Zero Retention
Raw rows are held in React state / sessionStorage for the browser session only. They are never sent to the backend. The governance disclosure banner is shown in both the DataTable and the upload screen.

### Q&A Panel
- Desktop (`lg+`): fixed right sidebar (`w-[380px]`), positioned below the sticky header (`top-16`, `h-[calc(100vh-4rem)]`), always visible while the main content scrolls
- Mobile: fixed bottom sheet, collapsed by default, expands to `max-h-[60vh]`
- Sends `column_summary`, `classifications`, and `data_context` inline with every request — does not depend on Supabase

### Column Highlight Bridge
Clicking a chart card sets `highlightColumns` to that chart's `x_column` and `y_column`. The DataTable highlights matching column headers (accent underline) and cells (tinted background). Clicking the same chart again clears the highlight.

## Design Tokens (Tailwind)

| Token | Hex | Usage |
|---|---|---|
| `dome-bg` | `#FFFFFF` | Page background |
| `dome-surface` | `#FAFAFA` | Card backgrounds |
| `dome-elevated` | `#F5F5F5` | Elevated surfaces, table headers |
| `dome-text` | `#0A0A0A` | Primary text |
| `dome-muted` | `#525252` | Secondary text, labels |
| `dome-tertiary` | `#A3A3A3` | Placeholder text, minor labels |
| `dome-border` | `#E8E8E8` | Default borders |
| `dome-border-accent` | `#99CCFF` | Focus / accent borders |
| `dome-accent` | `#0080FF` | Brand colour — links, highlights |
| `dome-accent-subtle` | `#E8F3FF` | Accent tint backgrounds |

## Build

```bash
npm run build    # production build — must pass 0 TypeScript errors
npm run lint     # ESLint
```
