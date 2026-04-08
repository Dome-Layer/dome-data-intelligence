'use client'

import RuleBadge from '@/components/ui/RuleBadge'
import { fmtValue } from './types'
import EmptyChart from './EmptyChart'
import type { ChartProps } from './types'

export default function KPICard({ chart, rows, classifications }: ChartProps) {
  const col = chart.y_column ?? ''
  const unit = classifications.find((c) => c.column_name === col)?.unit ?? null

  const classification = classifications.find((c) => c.column_name === col)
  const isSnapshot = classification?.aggregation_hint === 'last'

  const values = rows
    .map((r) => Number(r[col]))
    .filter((n) => isFinite(n) && !isNaN(n))

  if (!col || values.length === 0) {
    return (
      <div className="rounded-lg border border-dome-border bg-dome-surface p-4 shadow-sm">
        <EmptyChart message="No numeric data" />
      </div>
    )
  }

  const total = values.reduce((a, b) => a + b, 0)
  const primaryValue = isSnapshot ? values[values.length - 1] : total
  const primaryLabel = isSnapshot ? 'Latest' : 'Total'
  const mean = total / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)

  return (
    <div className="flex flex-col rounded-lg border border-dome-border bg-dome-surface p-4 shadow-sm min-w-0 overflow-hidden">
      <div className="mb-3 flex items-center justify-between">
        <RuleBadge ruleId={chart.rule_id} triggered />
        <span className="text-[11px] text-dome-muted">KPI</span>
      </div>

      <p className="mb-1 truncate text-xs text-dome-muted">{chart.title}</p>
      <p className="font-mono text-2xl font-bold text-dome-accent truncate">
        {fmtValue(primaryValue, unit)}
      </p>
      <p className="mt-0.5 text-xs text-dome-muted">{primaryLabel}</p>

      <div className="mt-4 grid grid-cols-3 gap-1 border-t border-dome-border pt-3 text-center">
        {(
          [
            ['Avg', mean],
            ['Min', min],
            ['Max', max],
          ] as [string, number][]
        ).map(([label, val]) => (
          <div key={label} className="min-w-0 overflow-hidden">
            <p className="font-mono text-[10px] font-medium text-dome-text truncate">{fmtValue(val, unit)}</p>
            <p className="text-[10px] text-dome-muted">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
