import type { GovernanceEvent } from '@/lib/types'
import RuleBadge from './RuleBadge'

interface GovernanceBadgeProps {
  event: GovernanceEvent
  className?: string
}

const HIL_LABELS: Record<string, string> = {
  not_required:  'Auto',
  recommended:   'Review recommended',
  required:      'Human review required',
  completed:     'Reviewed',
}

const HIL_COLOURS: Record<string, string> = {
  not_required:  'text-dome-success',
  recommended:   'text-dome-warning',
  required:      'text-dome-error',
  completed:     'text-dome-accent',
}

export default function GovernanceBadge({
  event,
  className = '',
}: GovernanceBadgeProps) {
  const ts = new Date(event.timestamp).toLocaleString('en-GB', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })

  return (
    <div
      className={[
        'rounded-lg border border-dome-border bg-dome-surface p-3 text-xs',
        className,
      ].join(' ')}
    >
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="font-mono text-dome-muted">{event.agent_id}</span>
        <span className="font-mono text-dome-muted">{ts}</span>
      </div>

      <p className="mb-2 text-dome-text">{event.output_summary}</p>

      <div className="flex flex-wrap items-center gap-2">
        {/* Confidence */}
        {event.confidence !== null && (
          <span className="rounded bg-dome-elevated px-1.5 py-0.5 font-mono text-dome-text ring-1 ring-dome-border">
            {Math.round(event.confidence * 100)}% confidence
          </span>
        )}

        {/* Human-in-loop */}
        <span className={['font-medium', HIL_COLOURS[event.human_in_loop] ?? 'text-dome-muted'].join(' ')}>
          {HIL_LABELS[event.human_in_loop] ?? event.human_in_loop}
        </span>

        {/* Rules triggered */}
        {event.rules_triggered.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.rules_applied.map((r) => (
              <RuleBadge
                key={r}
                ruleId={r}
                triggered={event.rules_triggered.includes(r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input hash — governance audit trail */}
      <p className="mt-2 font-mono text-[10px] text-dome-muted">
        {event.input_hash}
      </p>
    </div>
  )
}
