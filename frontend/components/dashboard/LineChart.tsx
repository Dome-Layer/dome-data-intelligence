'use client'

import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import RuleBadge from '@/components/ui/RuleBadge'
import { AXIS_TICK, GRID_PROPS, TOOLTIP_STYLE, fmtAxis, fmtValue, makeDateTickFormatter } from './types'
import EmptyChart from './EmptyChart'
import type { ChartProps } from './types'

export default function LineChart({ chart, rows, classifications }: ChartProps) {
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
  const data = Array.from(agg.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([x, y]) => ({ x, y }))

  if (data.length === 0) return <EmptyChart />

  const isDateCol = classifications.find((c) => c.column_name === xCol)?.classified_type === 'date'
  const xTickFormatter = isDateCol
    ? makeDateTickFormatter(data.map((d) => d.x))
    : (v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)

  return (
    <div className="rounded-lg border border-dome-border bg-dome-surface p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <RuleBadge ruleId={chart.rule_id} triggered />
        <span className="text-[11px] text-dome-muted">Line Chart</span>
      </div>
      <p className="mb-3 truncate text-sm font-semibold text-dome-text">{chart.title}</p>

      <ResponsiveContainer width="100%" height={240}>
        <RechartsLine data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="x"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval="preserveStartEnd"
            tickFormatter={xTickFormatter}
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
          <Line
            type="monotone"
            dataKey="y"
            stroke="#0891b2"
            strokeWidth={2}
            dot={{ r: 3, fill: '#0891b2', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#0891b2' }}
          />
        </RechartsLine>
      </ResponsiveContainer>
    </div>
  )
}
