'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import type { DashboardResponse, DataRow, ColumnSummary, ChartConfig, GovernanceEvent } from '@/lib/types'
import GovernanceBadge from '@/components/ui/GovernanceBadge'
import DashboardGrid from '@/components/dashboard/DashboardGrid'
import DataTable from '@/components/dashboard/DataTable'
import ColumnProfileTable from '@/components/dashboard/ColumnProfileTable'
import QAPanel from '@/components/qa/QAPanel'
import { computeDataContext } from '@/lib/dataContext'
import { useAuth } from '@/context/AuthContext'
import { getToken } from '@/lib/auth'
import Papa from 'papaparse'
import { saveDashboard, restoreDashboard, uploadDashboardData } from '@/lib/api'

interface SessionData {
  dashboard: DashboardResponse
  filename: string
  rows: DataRow[]
  columnSummary: ColumnSummary[]
  loadedSheets?: string[]
  skippedSheets?: string[]
}


type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function DashboardPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  const { isAuthenticated } = useAuth()

  const [data, setData] = useState<SessionData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [restoredView, setRestoredView] = useState(false)
  const [showColumnProfile, setShowColumnProfile] = useState(true)
  const [showRawData, setShowRawData] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // Column highlight bridge
  const [activeChartId, setActiveChartId] = useState<string | null>(null)
  const [highlightColumns, setHighlightColumns] = useState<string[]>([])

  function handleChartClick(chart: ChartConfig) {
    if (activeChartId === chart.chart_id) {
      // Second click on same chart — clear highlight
      setActiveChartId(null)
      setHighlightColumns([])
    } else {
      setActiveChartId(chart.chart_id)
      setHighlightColumns(
        [chart.x_column, chart.y_column].filter((c): c is string => c != null),
      )
    }
  }

  useEffect(() => {
    // Try sessionStorage first (populated during the original upload flow)
    const raw = sessionStorage.getItem(`dome_session_${sessionId}`)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SessionData & { expiresAt?: number }
        if (!parsed.expiresAt || Date.now() <= parsed.expiresAt) {
          setData(parsed)
          return
        }
        sessionStorage.removeItem(`dome_session_${sessionId}`)
      } catch {
        // fall through to server restore
      }
    }

    // sessionStorage miss — check cookie directly (synchronous, no race condition)
    if (!getToken()) {
      setNotFound(true)
      return
    }

    restoreDashboard(sessionId)
      .then(async (restored) => {
        let restoredRows: DataRow[] = []

        if (restored.data_url) {
          try {
            const csvRes = await fetch(restored.data_url)
            const csvText = await csvRes.text()
            const parsed = Papa.parse<DataRow>(csvText, {
              header: true,
              dynamicTyping: true,
              skipEmptyLines: true,
            })
            if (parsed.data.length > 0) {
              restoredRows = parsed.data
            }
          } catch {
            // non-fatal — degrade to metadata-only view
          }
        }

        const sessionData: SessionData = {
          dashboard: {
            session_id: sessionId,
            classifications: restored.classifications,
            charts: restored.charts,
            governance: restored.governance as DashboardResponse['governance'],
          },
          filename: restored.filename,
          rows: restoredRows,
          columnSummary: restored.column_summary,
        }
        setData(sessionData)
        if (restoredRows.length === 0) setRestoredView(true)
      })
      .catch(() => setNotFound(true))
  }, [sessionId, isAuthenticated])

  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-dome-muted">Session not found or expired.</p>
        <button
          onClick={() => router.push('/')}
          className="rounded-lg border border-dome-border px-4 py-2 text-sm text-dome-text hover:border-dome-border-accent"
        >
          Upload a new file
        </button>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <svg className="h-6 w-6 animate-spin-slow text-dome-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </main>
    )
  }

  const { dashboard, filename, rows, columnSummary, loadedSheets = [], skippedSheets = [] } = data
  const { classifications, charts } = dashboard
  const governance = (dashboard.governance as GovernanceEvent | null)
  const dataContext = computeDataContext(rows, classifications)

  function rowsToCSV(dataRows: DataRow[]): string {
    if (dataRows.length === 0) return ''
    const cols = Object.keys(dataRows[0])
    const header = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')
    const body = dataRows.map((row) =>
      cols.map((c) => {
        const v = row[c]
        if (v == null) return ''
        if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`
        return String(v)
      }).join(','),
    ).join('\n')
    return `${header}\n${body}`
  }

  async function handleSave() {
    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = `https://domelayer.com/login?redirect=${returnUrl}`;
      return
    }
    setSaveStatus('saving')
    try {
      await saveDashboard(sessionId, {
        filename,
        column_count: classifications.length,
        chart_count: charts.length,
      })
      // Upload raw rows to Supabase Storage — fire-and-forget, non-blocking
      if (rows.length > 0) {
        const csv = rowsToCSV(rows)
        uploadDashboardData(sessionId, csv).catch(() => {})
      }
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }

  return (
    <>
    {/* QAPanel is position:fixed — renders outside the scroll flow */}
    <QAPanel
      sessionId={sessionId}
      columnSummary={columnSummary ?? []}
      classifications={classifications}
      dataContext={dataContext}
    />

    <main className="min-h-screen py-10 pb-20 lg:pb-10">
      <div className="lg:grid lg:grid-cols-[1fr_396px]">
      <div className="px-6 md:px-8 space-y-6 min-w-0">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="shrink-0">
              <Image src="/dome-logo.svg" alt="Dome" width={28} height={28} />
            </button>
            <div>
              <h1 className="text-base font-semibold text-dome-text">{filename}</h1>
              <p className="font-mono text-xs text-dome-muted">
                {classifications.length} columns · {charts.length} charts · session {sessionId.slice(0, 8)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving' || saveStatus === 'saved'}
              className="rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-default"
              style={{
                borderColor: saveStatus === 'saved' ? 'var(--color-success-border, #22c55e)' : 'var(--color-border-accent)',
                color: saveStatus === 'saved' ? 'var(--color-success, #22c55e)' : 'var(--color-accent)',
                opacity: saveStatus === 'saving' ? 0.6 : 1,
              }}
            >
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : saveStatus === 'error' ? 'Error — retry' : 'Save'}
            </button>
            <button
              onClick={() => router.push('/')}
              className="rounded-lg border border-dome-border px-3 py-1.5 text-xs text-dome-muted hover:border-dome-border-accent hover:text-dome-text"
            >
              New file
            </button>
          </div>
        </div>

        {/* Sheet info banner */}
        {loadedSheets.length > 0 && (
          <div className="rounded-lg border border-dome-border bg-dome-elevated px-4 py-2.5 text-xs text-dome-muted">
            {loadedSheets.length === 1
              ? <>Loaded sheet <span className="font-mono text-dome-text">{loadedSheets[0]}</span></>
              : <>Merged {loadedSheets.length} sheets: {loadedSheets.map((s, i) => (
                  <span key={s}>{i > 0 && ', '}<span className="font-mono text-dome-text">{s}</span></span>
                ))}</>
            }
            {skippedSheets.length > 0 && (
              <span className="ml-2 text-dome-warning">
                · Skipped {skippedSheets.length} sheet{skippedSheets.length > 1 ? 's' : ''} with different columns: {skippedSheets.join(', ')}
              </span>
            )}
          </div>
        )}

        {/* Restored-view notice */}
        {restoredView && (
          <div className="rounded-lg border border-dome-border bg-dome-elevated px-4 py-2.5 text-xs text-dome-muted">
            Charts and data table require the original file.{' '}
            <button
              onClick={() => router.push('/')}
              className="underline hover:text-dome-text"
            >
              Re-upload to restore full view.
            </button>
          </div>
        )}

        {/* Governance */}
        {governance && <GovernanceBadge event={governance} />}

        {/* Charts — click a chart to highlight its columns in the data table */}
        <DashboardGrid
          charts={charts}
          rows={rows}
          classifications={classifications}
          activeChartId={activeChartId}
          onChartClick={handleChartClick}
        />

        {/* Column Profile — open by default */}
        <div className="rounded-lg border border-dome-border bg-dome-surface">
          <button
            onClick={() => setShowColumnProfile((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-xs font-medium uppercase tracking-widest text-dome-muted">
              Column Profile ({classifications.length} columns)
            </span>
            <svg
              className={[
                'h-4 w-4 text-dome-muted transition-transform',
                showColumnProfile ? 'rotate-180' : '',
              ].join(' ')}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {showColumnProfile && (
            <div className="border-t border-dome-border px-4 pb-4 pt-3">
              <ColumnProfileTable
                classifications={classifications}
                columnSummary={columnSummary ?? []}
                rowCount={rows.length}
              />
            </div>
          )}
        </div>

        {/* Raw Data — collapsed by default; hidden if no rows (restored view) */}
        {rows.length > 0 && <div className="rounded-lg border border-dome-border bg-dome-surface">
          <button
            onClick={() => setShowRawData((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-xs font-medium uppercase tracking-widest text-dome-muted">
              Raw Data {rows.length > 0 ? `(${rows.length.toLocaleString()} rows)` : ''}
            </span>
            <svg
              className={[
                'h-4 w-4 text-dome-muted transition-transform',
                showRawData ? 'rotate-180' : '',
              ].join(' ')}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {showRawData && (
            <div className="border-t border-dome-border px-4 pb-4 pt-3">
              <DataTable
                rows={rows}
                filename={filename}
                highlightColumns={highlightColumns}
                showCsvDownload={false}
                classifications={classifications}
              />
            </div>
          )}
        </div>}


      </div>
      {/* Spacer column — QAPanel (position:fixed) overlays this */}
      <div className="hidden lg:block" aria-hidden="true" />
      </div>
    </main>
    </>
  )
}
