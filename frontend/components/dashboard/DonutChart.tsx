'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import RuleBadge from '@/components/ui/RuleBadge'
import { TOOLTIP_STYLE, DOME_PALETTE, fmtValue } from './types'
import EmptyChart from './EmptyChart'
import type { ChartProps } from './types'

export default function DonutChart({ chart, rows, classifications }: ChartProps) {
  const xCol = chart.x_column ?? ''
  const yCol = chart.y_column ?? ''
  const unit = classifications.find((c) => c.column_name === yCol)?.unit ?? null

  if (!xCol || !yCol || rows.length === 0) return <EmptyChart />

  const agg = new Map<string, number>()
  for (const row of rows) {
    const name = String(row[xCol] ?? '')
    const val = Number(row[yCol] ?? 0)
    if (name && isFinite(val)) agg.set(name, (agg.get(name) ?? 0) + val)
  }
  const data = Array.from(agg.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }))

  if (data.length === 0) return <EmptyChart />

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="rounded-lg border border-dome-border bg-dome-surface p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <RuleBadge ruleId={chart.rule_id} triggered />
        <span className="text-[11px] text-dome-muted">Donut Chart</span>
      </div>
      <p className="mb-3 truncate text-sm font-semibold text-dome-text">{chart.title}</p>

      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius="52%"
            outerRadius="72%"
            dataKey="value"
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={DOME_PALETTE[i % DOME_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(v: number, name: string) => [
              `${fmtValue(v, unit)} (${((v / total) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', color: '#64748b' }}
            formatter={(value: string) =>
              value.length > 16 ? `${value.slice(0, 15)}…` : value
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
