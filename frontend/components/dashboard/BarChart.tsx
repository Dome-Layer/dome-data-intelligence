'use client'

import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import RuleBadge from '@/components/ui/RuleBadge'
import { AXIS_TICK, GRID_PROPS, TOOLTIP_STYLE, fmtAxis, fmtValue } from './types'
import EmptyChart from './EmptyChart'
import type { ChartProps } from './types'

const MAX_BARS = 20

export default function BarChart({ chart, rows, classifications }: ChartProps) {
  const xCol = chart.x_column ?? ''
  const yCol = chart.y_column ?? ''
  const unit = classifications.find((c) => c.column_name === yCol)?.unit ?? null

  if (!xCol || !yCol || rows.length === 0) return <EmptyChart />

  const agg = new Map<string, number>()
  for (const row of rows) {
    const x = String(row[xCol] ?? '')
    const y = Number(row[yCol] ?? 0)
    if (x && isFinite(y)) agg.set(x, (agg.get(x) ?? 0) + y)
  }

  const all = Array.from(agg.entries()).sort(([, a], [, b]) => b - a)
  const data = all.slice(0, MAX_BARS).map(([x, y]) => ({ x, y }))
  const truncated = all.length - data.length

  if (data.length === 0) return <EmptyChart />

  const tickFormatter = (v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)

  return (
    <div className="rounded-lg border border-dome-border bg-dome-surface p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <RuleBadge ruleId={chart.rule_id} triggered />
        <span className="text-[11px] text-dome-muted">Bar Chart</span>
      </div>
      <p className="mb-1 truncate text-sm font-semibold text-dome-text">{chart.title}</p>
      {truncated > 0 && (
        <p className="mb-2 text-[11px] text-dome-muted">
          Top {MAX_BARS} of {all.length} categories
        </p>
      )}

      <ResponsiveContainer width="100%" height={240}>
        <RechartsBar data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid {...GRID_PROPS} vertical={false} />
          <XAxis
            dataKey="x"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tickFormatter={tickFormatter}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtAxis}
            width={52}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(v: number) => [fmtValue(v, unit), yCol]}
          />
          <Bar dataKey="y" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? '#0891b2' : '#0891b280'} />
            ))}
          </Bar>
        </RechartsBar>
      </ResponsiveContainer>
    </div>
  )
}
