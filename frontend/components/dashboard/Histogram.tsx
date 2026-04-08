'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import RuleBadge from '@/components/ui/RuleBadge'
import { AXIS_TICK, GRID_PROPS, TOOLTIP_STYLE } from './types'
import EmptyChart from './EmptyChart'
import type { ChartProps } from './types'

const BIN_COUNT = 10

function computeBins(values: number[]): { label: string; count: number }[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return [{ label: String(min), count: values.length }]

  const binSize = (max - min) / BIN_COUNT
  const fmt = (n: number) =>
    Math.abs(n) >= 1000 ? `${+(n / 1000).toFixed(1)}K` : n.toFixed(n % 1 === 0 ? 0 : 1)

  const bins = Array.from({ length: BIN_COUNT }, (_, i) => ({
    label: `${fmt(min + i * binSize)}–${fmt(min + (i + 1) * binSize)}`,
    count: 0,
  }))
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binSize), BIN_COUNT - 1)
    bins[idx].count++
  }
  return bins
}

export default function Histogram({ chart, rows }: ChartProps) {
  const xCol = chart.x_column ?? ''
  if (!xCol || rows.length === 0) return <EmptyChart />

  const values = rows
    .map((r) => Number(r[xCol]))
    .filter((n) => isFinite(n) && !isNaN(n))

  if (values.length === 0) return <EmptyChart />

  const bins = computeBins(values)

  return (
    <div className="rounded-lg border border-dome-border bg-dome-surface p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <RuleBadge ruleId={chart.rule_id} triggered />
        <span className="text-[11px] text-dome-muted">Histogram</span>
      </div>
      <p className="mb-3 truncate text-sm font-semibold text-dome-text">{chart.title}</p>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={bins} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid {...GRID_PROPS} vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval={1}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v, 'Count']} />
          <Bar dataKey="count" fill="#0891b2" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
