'use client'

import type { ColumnClassification, ColumnSummary } from '@/lib/types'

interface ColumnProfileTableProps {
  classifications: ColumnClassification[]
  columnSummary: ColumnSummary[]
  rowCount: number
}

const TYPE_COLOURS: Record<string, string> = {
  date:             'text-dome-accent bg-dome-accent-subtle ring-dome-border-accent',
  ordered_category: 'text-dome-muted bg-dome-elevated ring-dome-border',
  category:         'text-dome-warning bg-dome-warning-subtle ring-dome-warning-border',
  metric:           'text-dome-success bg-dome-success-subtle ring-dome-success-border',
}

function fmt(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—'
  return n.toLocaleString('en-GB', { maximumFractionDigits: 2 })
}

export default function ColumnProfileTable({
  classifications,
  columnSummary,
  rowCount,
}: ColumnProfileTableProps) {
  const summaryByName = Object.fromEntries(columnSummary.map((s) => [s.name, s]))

  function downloadCSV() {
    const headers = ['Column', 'Type', 'Unique', 'Null%', 'Min', 'Max', 'Mean', 'Samples', 'Unit', 'Note']
    const csvRows = classifications.map((col) => {
      const s = summaryByName[col.column_name]
      const nullPct = s && rowCount > 0 ? ((s.null_count / rowCount) * 100).toFixed(1) + '%' : '—'
      const isMetric = col.classified_type === 'metric'
      return [
        col.column_name,
        col.classified_type,
        String(col.unique_count),
        nullPct,
        isMetric ? fmt(s?.min) : '',
        isMetric ? fmt(s?.max) : '',
        isMetric ? fmt(s?.mean) : '',
        s?.sample_values?.slice(0, 3).join(', ') ?? '',
        col.unit ?? '',
        col.note ?? '',
      ]
    })
    const csv = [headers, ...csvRows]
      .map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'column_profile.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          onClick={downloadCSV}
          className="rounded border border-dome-border px-3 py-1 text-xs text-dome-muted hover:border-dome-border-accent hover:text-dome-accent"
        >
          Download CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-dome-border">
        <table className="w-full min-w-max">
          <thead>
            <tr className="border-b border-dome-border bg-dome-elevated">
              {['Column', 'Type', 'Unique', 'Null%', 'Min', 'Max', 'Mean', 'Samples', 'Unit', 'Note'].map((h) => (
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
            {classifications.map((col) => {
              const s = summaryByName[col.column_name]
              const colour =
                TYPE_COLOURS[col.classified_type] ?? 'text-dome-muted bg-dome-elevated ring-dome-border'
              const nullPct =
                s && rowCount > 0 ? `${((s.null_count / rowCount) * 100).toFixed(1)}%` : '—'
              const isMetric = col.classified_type === 'metric'
              const samples = s?.sample_values?.slice(0, 3).join(', ') ?? '—'
              return (
                <tr key={col.column_name} className="border-b border-dome-border last:border-0">
                  <td className="px-3 py-2 font-mono text-sm text-dome-text">{col.column_name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-xs ring-1 ${colour}`}
                    >
                      {col.classified_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-dome-muted">{col.unique_count}</td>
                  <td className="px-3 py-2 font-mono text-xs text-dome-muted">{nullPct}</td>
                  <td className="px-3 py-2 font-mono text-xs text-dome-muted">
                    {isMetric ? fmt(s?.min) : ''}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-dome-muted">
                    {isMetric ? fmt(s?.max) : ''}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-dome-muted">
                    {isMetric ? fmt(s?.mean) : ''}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs text-dome-muted">
                    {samples}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-dome-muted">{col.unit ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-dome-muted">{col.note ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
