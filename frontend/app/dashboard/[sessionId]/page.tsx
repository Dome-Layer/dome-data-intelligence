'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import type { DashboardResponse, DataRow, ColumnClassification, ColumnSummary, ChartConfig, GovernanceEvent } from '@/lib/types'
import GovernanceBadge from '@/components/ui/GovernanceBadge'
import DashboardGrid from '@/components/dashboard/DashboardGrid'
import DataTable from '@/components/dashboard/DataTable'
import QAPanel from '@/components/qa/QAPanel'
import { computeDataContext } from '@/lib/dataContext'
import { useAuth } from '@/context/AuthContext'
import { getToken } from '@/lib/auth'
import { saveDashboard, restoreDashboard } from '@/lib/api'

interface SessionData {
  dashboard: DashboardResponse
  filename: string
  rows: DataRow[]
  columnSummary: ColumnSummary[]
  loadedSheets?: string[]
  skippedSheets?: string[]
}

const TYPE_COLOURS: Record<string, string> = {
  date:             'text-dome-accent bg-dome-accent-subtle ring-dome-border-accent',
  ordered_category: 'text-dome-muted bg-dome-elevated ring-dome-border',
  category:         'text-dome-warning bg-dome-warning-subtle ring-dome-warning-border',
  metric:           'text-dome-success bg-dome-success-subtle ring-dome-success-border',
}

function ClassificationsTable({ cols }: { cols: ColumnClassification[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-dome-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-dome-border bg-dome-elevated">
            {['Column', 'Type', 'Unique', 'Unit', 'Note'].map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left font-mono text-xs font-medium text-dome-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-dome-surface">
          {cols.map((col) => {
            const colour =
              TYPE_COLOURS[col.classified_type] ??
              'text-dome-muted bg-dome-elevated ring-dome-border'
            return (
              <tr key={col.column_name} className="border-b border-dome-border last:border-0">
                <td className="px-3 py-2 font-mono text-sm text-dome-text">
                  {col.column_name}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 font-mono text-xs ring-1 ${colour}`}
                  >
                    {col.classified_type}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-dome-muted">
                  {col.unique_count}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-dome-muted">
                  {col.unit ?? '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-dome-muted">
                  {col.note ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
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
  const [showClassifications, setShowClassifications] = useState(false)
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
      .then((restored) => {
        const sessionData: SessionData = {
          dashboard: {
            session_id: sessionId,
            classifications: restored.classifications,
            charts: restored.charts,
            governance: restored.governance as DashboardResponse['governance'],
          },
          filename: restored.filename,
          rows: [],
          columnSummary: restored.column_summary,
        }
        setData(sessionData)
        setRestoredView(true)
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

        {/* Column classifications — collapsible */}
        <div className="rounded-lg border border-dome-border bg-dome-surface">
          <button
            onClick={() => setShowClassifications((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-xs font-medium uppercase tracking-widest text-dome-muted">
              Column Classifications ({classifications.length})
            </span>
            <svg
              className={[
                'h-4 w-4 text-dome-muted transition-transform',
                showClassifications ? 'rotate-180' : '',
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
          {showClassifications && (
            <div className="border-t border-dome-border px-4 pb-4 pt-3">
              <ClassificationsTable cols={classifications} />
            </div>
          )}
        </div>

        {/* Raw data table */}
        <DataTable
          rows={rows}
          filename={filename}
          highlightColumns={highlightColumns}
        />


      </div>
      {/* Spacer column — QAPanel (position:fixed) overlays this */}
      <div className="hidden lg:block" aria-hidden="true" />
      </div>
    </main>
    </>
  )
}
