'use client'

import type { ReactNode } from 'react'
import type { ChartConfig, DataRow, ColumnClassification } from '@/lib/types'
import KPICard from './KPICard'
import LineChart from './LineChart'
import BarChart from './BarChart'
import DonutChart from './DonutChart'
import Histogram from './Histogram'
import ScatterPlot from './ScatterPlot'
import SummaryTable from './SummaryTable'
import type { ChartProps } from './types'

interface DashboardGridProps {
  charts: ChartConfig[]
  rows: DataRow[]
  classifications: ColumnClassification[]
  activeChartId?: string | null
  onChartClick?: (chart: ChartConfig) => void
}

function renderChart(props: ChartProps) {
  switch (props.chart.chart_type) {
    case 'line':          return <LineChart {...props} />
    case 'bar':           return <BarChart {...props} />
    case 'kpi':           return <KPICard {...props} />
    case 'histogram':     return <Histogram {...props} />
    case 'donut':         return <DonutChart {...props} />
    case 'summary_table': return <SummaryTable {...props} />
    case 'scatter':       return <ScatterPlot {...props} />
    default:              return null
  }
}

export default function DashboardGrid({
  charts,
  rows,
  classifications,
  activeChartId,
  onChartClick,
}: DashboardGridProps) {
  const kpiCharts   = charts.filter((c) => c.chart_type === 'kpi')
  const otherCharts = charts.filter(
    (c) => c.chart_type !== 'kpi' && c.chart_type !== 'summary_table',
  )

  const chartProps = (chart: ChartConfig): ChartProps => ({ chart, rows, classifications })

  function chartWrapper(chart: ChartConfig, content: ReactNode) {
    const isActive = activeChartId === chart.chart_id
    return (
      <div
        key={chart.chart_id}
        onClick={() => onChartClick?.(chart)}
        className={[
          onChartClick ? 'cursor-pointer' : '',
          isActive ? 'rounded-lg ring-2 ring-dome-accent ring-offset-1' : '',
        ].join(' ')}
      >
        {content}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI row */}
      {kpiCharts.length > 0 && (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
          {kpiCharts.map((chart) => chartWrapper(chart, renderChart(chartProps(chart))))}
        </div>
      )}

      {/* Other charts — 2-column grid on large screens */}
      {otherCharts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {otherCharts.map((chart) => chartWrapper(chart, renderChart(chartProps(chart))))}
        </div>
      )}

    </div>
  )
}
