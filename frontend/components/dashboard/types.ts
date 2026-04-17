import type { ChartConfig, DataRow, ColumnClassification } from '@/lib/types'

export interface ChartProps {
  chart: ChartConfig
  rows: DataRow[]
  classifications: ColumnClassification[]
}

// Light-theme palette — saturated enough to read on white
export const DOME_PALETTE = [
  '#0891b2', // cyan-600 (primary)
  '#7c3aed', // violet-600
  '#059669', // emerald-600
  '#ea580c', // orange-600
  '#db2777', // pink-600
  '#2563eb', // blue-600
  '#d97706', // amber-600
  '#dc2626', // red-600
]

export const AXIS_TICK = {
  fill: '#94a3b8',   // slate-400
  fontSize: 11,
  fontFamily: 'var(--font-sans, ui-sans-serif)',
}

export const GRID_PROPS = {
  strokeDasharray: '3 3' as const,
  stroke: '#e2e8f0',  // slate-200
}

export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontFamily: 'var(--font-sans, ui-sans-serif)',
    fontSize: '12px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
  },
  labelStyle: { color: '#64748b', fontWeight: 500 },
  itemStyle: { color: '#0f172a' },
  cursor: { fill: 'rgba(8, 145, 178, 0.04)' },
}

export function fmtAxis(n: number): string {
  if (!isFinite(n)) return ''
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${+(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${+(abs / 1_000).toFixed(1)}K`
  return `${sign}${abs.toLocaleString('en-GB', { maximumFractionDigits: 1 })}`
}

/**
 * Returns a tick formatter for date x-axes. Chooses "Jan '24" vs "15 Jan" based on data span.
 */
export function makeDateTickFormatter(xValues: string[]): (v: string) => string {
  const times = xValues
    .map((s) => new Date(s).getTime())
    .filter((t) => isFinite(t))
  if (times.length === 0) return (v) => v
  const spanDays = (Math.max(...times) - Math.min(...times)) / 86_400_000
  return (v: string) => {
    const d = new Date(v)
    if (isNaN(d.getTime())) return v
    return spanDays > 365
      ? d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
      : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  }
}

export function fmtValue(n: number, unit?: string | null): string {
  if (!isFinite(n)) return '—'
  const prefix = unit === 'EUR' ? '€' : unit === 'USD' ? '$' : unit === 'GBP' ? '£' : ''
  const suffix = unit && !['EUR', 'USD', 'GBP'].includes(unit) ? ` ${unit}` : ''
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${prefix}${+(abs / 1_000_000).toFixed(2)}M${suffix}`
  if (abs >= 1_000) return `${sign}${prefix}${+(abs / 1_000).toFixed(1)}K${suffix}`
  return `${sign}${prefix}${abs.toLocaleString('en-GB', { maximumFractionDigits: 2 })}${suffix}`
}
