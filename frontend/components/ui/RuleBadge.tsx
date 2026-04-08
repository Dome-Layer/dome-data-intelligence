interface RuleBadgeProps {
  ruleId: string
  triggered?: boolean
  className?: string
}

const RULE_META: Record<string, { name: string; desc: string }> = {
  'R-01': { name: 'Line chart',     desc: 'Trend over time' },
  'R-02': { name: 'Bar chart',      desc: 'Category comparison' },
  'R-03': { name: 'KPI card',       desc: 'Key metric summary' },
  'R-04': { name: 'Histogram',      desc: 'Value distribution' },
  'R-05': { name: 'Donut chart',    desc: 'Part-of-whole breakdown' },
  'R-06': { name: 'Summary table',  desc: 'Top rows preview' },
  'R-07': { name: 'Scatter plot',   desc: 'Correlation between metrics' },
}

export default function RuleBadge({
  ruleId,
  triggered = false,
  className = '',
}: RuleBadgeProps) {
  const meta = RULE_META[ruleId]
  const label = meta?.name ?? ruleId
  const title = meta ? `${meta.name} — ${meta.desc}` : ruleId

  return (
    <span
      title={title}
      className={[
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
        triggered
          ? 'bg-dome-accent-subtle text-dome-accent ring-1 ring-dome-border-accent'
          : 'bg-dome-elevated text-dome-muted ring-1 ring-dome-border',
        className,
      ].join(' ')}
    >
      {label}
      <span className={['font-mono text-[10px]', triggered ? 'text-dome-accent/60' : 'text-dome-tertiary'].join(' ')}>
        {ruleId}
      </span>
    </span>
  )
}
