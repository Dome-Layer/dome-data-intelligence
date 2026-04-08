'use client'

import RuleBadge from '@/components/ui/RuleBadge'
import { fmtValue } from './types'
import type { ChartProps } from './types'

const MAX_ROWS = 20

function fmtCell(val: string | number | null | undefined, type: string | undefined, unit: string | null | undefined): string {
  if (val === null || val === undefined) return ''

  if (type === 'metric') {
    const n = Number(val)
    return isFinite(n) ? fmtValue(n, unit) : String(val)
  }

  if (type === 'date') {
    const d = new Date(String(val))
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }
  }

  return String(val)
}

export default function SummaryTable({ chart, rows, classifications }: ChartProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dome-border bg-dome-surface p-4 shadow-sm">
        <p className="text-sm text-dome-muted">No data</p>
      </div>
    )
  }

  const columns = Object.keys(rows[0])
  const preview = rows.slice(0, MAX_ROWS)
  const colMeta = Object.fromEntries(
    classifications.map((c) => [c.column_name, { type: c.classified_type, unit: c.unit }])
  )

  return (
    <div className="rounded-lg border border-dome-border bg-dome-surface p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <RuleBadge ruleId={chart.rule_id} triggered />
        <span className="text-[11px] text-dome-muted">Summary Table</span>
      </div>
      <p className="mb-1 truncate text-sm font-semibold text-dome-text">{chart.title}</p>
      <p className="mb-3 text-xs text-dome-muted">
        Top {Math.min(MAX_ROWS, rows.length)} of {rows.length} rows · {columns.length} columns
      </p>

      <div className="overflow-x-auto rounded border border-dome-border">
        <table className="w-full min-w-max text-left">
          <thead>
            <tr className="border-b border-dome-border bg-dome-elevated">
              {columns.map((col) => {
                const isNumeric = colMeta[col]?.type === 'metric'
                return (
                  <th
                    key={col}
                    className={[
                      'whitespace-nowrap px-3 py-2 text-xs font-semibold text-dome-muted',
                      isNumeric ? 'text-right' : '',
                    ].join(' ')}
                  >
                    {col}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr
                key={i}
                className={[
                  'border-b border-dome-border last:border-0',
                  i % 2 === 0 ? '' : 'bg-dome-elevated/60',
                ].join(' ')}
              >
                {columns.map((col) => {
                  const val = row[col]
                  const meta = colMeta[col]
                  const formatted = fmtCell(val, meta?.type, meta?.unit)
                  const isNumeric = meta?.type === 'metric'
                  return (
                    <td
                      key={col}
                      className={[
                        'whitespace-nowrap px-3 py-1.5 text-xs',
                        isNumeric ? 'text-right font-mono text-dome-text' : 'text-dome-text',
                      ].join(' ')}
                    >
                      {formatted || <span className="text-dome-muted">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
