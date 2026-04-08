'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import RuleBadge from '@/components/ui/RuleBadge'
import { AXIS_TICK, GRID_PROPS, TOOLTIP_STYLE, DOME_PALETTE, fmtAxis, fmtValue } from './types'
import EmptyChart from './EmptyChart'
import type { ChartProps } from './types'

// Beyond this many categories, collapse into a single "all" series to
// prevent the legend from rendering hundreds of entries.
const MAX_COLOR_GROUPS = 8

export default function ScatterPlot({ chart, rows, classifications }: ChartProps) {
  const xCol = chart.x_column ?? ''
  const yCol = chart.y_column ?? ''
  const colorCol = chart.color_column ?? null

  const xUnit = classifications.find((c) => c.column_name === xCol)?.unit ?? null
  const yUnit = classifications.find((c) => c.column_name === yCol)?.unit ?? null

  if (!xCol || !yCol || rows.length === 0) return <EmptyChart />

  const clean = rows
    .map((r) => ({
      x: Number(r[xCol]),
      y: Number(r[yCol]),
      group: colorCol ? String(r[colorCol] ?? '') : '_all',
    }))
    .filter((d) => isFinite(d.x) && isFinite(d.y))

  if (clean.length === 0) return <EmptyChart />

  // Build groups
  const rawGroups = new Map<string, { x: number; y: number }[]>()
  for (const d of clean) {
    if (!rawGroups.has(d.group)) rawGroups.set(d.group, [])
    rawGroups.get(d.group)!.push({ x: d.x, y: d.y })
  }

  // If too many unique categories, collapse to a single series
  const groupEntries: [string, { x: number; y: number }[]][] =
    rawGroups.size <= MAX_COLOR_GROUPS
      ? Array.from(rawGroups.entries())
      : [['_all', clean.map((d) => ({ x: d.x, y: d.y }))]]

  const showLegend = groupEntries.length > 1 && groupEntries[0][0] !== '_all'

  return (
    <div className="rounded-lg border border-dome-border bg-dome-surface p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <RuleBadge ruleId={chart.rule_id} triggered />
        <span className="text-[11px] text-dome-muted">Scatter Plot</span>
      </div>
      <p className="mb-3 truncate text-sm font-semibold text-dome-text">{chart.title}</p>

      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            type="number"
            dataKey="x"
            name={xCol}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tickFormatter={fmtAxis}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yCol}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtAxis}
            width={52}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            cursor={{ strokeDasharray: '3 3', stroke: '#e2e8f0' }}
            formatter={(v: number, name: string) => {
              const unit = name === xCol ? xUnit : yUnit
              return [fmtValue(v, unit), name]
            }}
          />
          {showLegend && (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', color: '#64748b' }}
              formatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
            />
          )}
          {groupEntries.map(([key, points], i) => (
            <Scatter
              key={key}
              name={key === '_all' ? yCol : key}
              data={points}
              fill={DOME_PALETTE[i % DOME_PALETTE.length]}
              fillOpacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
