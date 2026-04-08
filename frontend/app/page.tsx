'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import DropZone from '@/components/upload/DropZone'
import UploadProgress from '@/components/upload/UploadProgress'
import { uploadSummary, generateDashboard, APIError } from '@/lib/api'
import { parseFile, loadDemoFile } from '@/lib/fileParser'
import type { ParsedFile } from '@/lib/types'

type UploadStep = 'parsing' | 'uploading' | 'classifying' | 'done'

type State =
  | { status: 'idle' }
  | { status: 'running'; step: UploadStep; filename: string }
  | { status: 'error'; message: string }

const DEMO_DATASETS = [
  {
    filename: 'commodity_position_report.csv',
    label: 'Commodity Position',
    description: '28 rows · Trade Finance · R-01 R-02 R-03 R-05 R-06 R-07',
  },
  {
    filename: 'it_budget_vs_actuals.csv',
    label: 'IT Budget vs Actuals',
    description: '96 rows · IT Finance · R-02 R-03 R-05 R-06 R-07',
  },
  {
    filename: 'procurement_spend_by_supplier.csv',
    label: 'Procurement Spend',
    description: '135 rows · Procurement · R-02 R-03 R-05 R-06 R-07',
  },
]

export default function UploadPage() {
  const router = useRouter()
  const [state, setState] = useState<State>({ status: 'idle' })

  const runPipeline = useCallback(
    async (parsed: ParsedFile) => {
      const { filename, rowCount, columnSummary, rows, loadedSheets, skippedSheets } = parsed

      try {
        // Step 1: upload column summary
        setState({ status: 'running', step: 'uploading', filename })
        const uploadRes = await uploadSummary({
          filename,
          row_count: rowCount,
          column_summary: columnSummary,
        })

        // Step 2: classify + generate dashboard
        setState({ status: 'running', step: 'classifying', filename })
        const dashboardRes = await generateDashboard({
          session_id: uploadRes.session_id,
          column_summary: uploadRes.column_summary,
        })

        // Step 3: persist to sessionStorage and navigate
        setState({ status: 'running', step: 'done', filename })
        try {
          sessionStorage.setItem(
            `dome_session_${uploadRes.session_id}`,
            JSON.stringify({
              dashboard: dashboardRes,
              filename,
              rows,
              columnSummary: uploadRes.column_summary,
              loadedSheets,
              skippedSheets,
            }),
          )
        } catch {
          // sessionStorage full — store without rows (DataTable falls back gracefully)
          sessionStorage.setItem(
            `dome_session_${uploadRes.session_id}`,
            JSON.stringify({
              dashboard: dashboardRes,
              filename,
              rows: [],
              columnSummary: uploadRes.column_summary,
              loadedSheets,
              skippedSheets,
            }),
          )
        }

        router.push(`/dashboard/${uploadRes.session_id}`)
      } catch (err) {
        const message =
          err instanceof APIError
            ? `API error ${err.status}: ${err.message}`
            : err instanceof Error
            ? err.message
            : 'An unexpected error occurred'
        setState({ status: 'error', message })
      }
    },
    [router],
  )

  const onParsed = useCallback(
    (parsed: ParsedFile) => {
      setState({ status: 'running', step: 'parsing', filename: parsed.filename })
      // Defer to next tick so the UI updates before the (sync) parsing completes
      setTimeout(() => runPipeline(parsed), 0)
    },
    [runPipeline],
  )

  const onError = useCallback((message: string) => {
    setState({ status: 'error', message })
  }, [])

  const onDemoClick = useCallback(
    async (filename: string) => {
      setState({ status: 'running', step: 'parsing', filename })
      try {
        const file = await loadDemoFile(filename)
        const parsed = await parseFile(file)
        runPipeline(parsed)
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to load demo')
      }
    },
    [runPipeline, onError],
  )

  const isRunning = state.status === 'running'

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl">

        {/* Tagline */}
        <div className="mb-10 text-center">
          <p className="text-sm text-dome-muted">
            Upload any spreadsheet. Get a governed analytics dashboard in seconds.
          </p>
        </div>

        {/* Upload area or progress */}
        {state.status === 'running' ? (
          <UploadProgress step={state.step} filename={state.filename} />
        ) : (
          <DropZone onParsed={onParsed} onError={onError} disabled={isRunning} />
        )}

        {/* Error */}
        {state.status === 'error' && (
          <div className="mt-4 rounded-lg border border-dome-error-border bg-dome-error-subtle px-4 py-3">
            <p className="text-sm text-dome-error">{state.message}</p>
            <button
              onClick={() => setState({ status: 'idle' })}
              className="mt-2 text-xs text-dome-muted underline hover:text-dome-text"
            >
              Try again
            </button>
          </div>
        )}

        {/* Demo datasets */}
        {state.status === 'idle' && (
          <div className="mt-8">
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-dome-muted">
              Or try a demo dataset
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {DEMO_DATASETS.map((d) => (
                <button
                  key={d.filename}
                  onClick={() => onDemoClick(d.filename)}
                  className="rounded-lg border border-dome-border bg-dome-elevated px-3 py-3 text-left transition-colors hover:border-dome-border-accent hover:bg-dome-surface"
                >
                  <p className="text-sm font-medium text-dome-text">{d.label}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-dome-muted">
                    {d.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Zero-retention notice */}
        <div className="mt-10 text-center">
          <p className="governance-banner">
            Your data is never uploaded — all rows are processed locally in your browser
          </p>
        </div>

      </div>
    </main>
  )
}
