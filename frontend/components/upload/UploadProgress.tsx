type UploadStep = 'parsing' | 'uploading' | 'classifying' | 'done'

interface UploadProgressProps {
  step: UploadStep
  filename: string
}

const STEPS: { id: UploadStep; label: string; detail: string }[] = [
  {
    id: 'parsing',
    label: 'Parsing file locally',
    detail: 'Extracting column summary — raw data stays in your browser',
  },
  {
    id: 'uploading',
    label: 'Uploading column summary',
    detail: 'Sending metadata only — no rows transmitted',
  },
  {
    id: 'classifying',
    label: 'Classifying columns',
    detail: 'LLM identifies column types and units',
  },
  {
    id: 'done',
    label: 'Dashboard ready',
    detail: 'Redirecting…',
  },
]

function stepIndex(step: UploadStep): number {
  return STEPS.findIndex((s) => s.id === step)
}

export default function UploadProgress({ step, filename }: UploadProgressProps) {
  const current = stepIndex(step)

  return (
    <div className="w-full rounded-xl border border-dome-border bg-dome-surface p-6">
      {/* Filename */}
      <p className="mb-5 truncate font-mono text-sm text-dome-muted">
        {filename}
      </p>

      <ol className="space-y-4">
        {STEPS.map((s, i) => {
          const done = i < current
          const active = i === current
          const pending = i > current

          return (
            <li key={s.id} className="flex items-start gap-3">
              {/* Indicator */}
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                {done && (
                  <svg className="h-5 w-5 text-dome-success" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                  </svg>
                )}
                {active && (
                  <svg className="h-4 w-4 animate-spin-slow text-dome-accent" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                )}
                {pending && (
                  <span className="h-2 w-2 rounded-full bg-dome-border" />
                )}
              </span>

              {/* Text */}
              <div>
                <p className={[
                  'text-sm font-medium leading-5',
                  done    ? 'text-dome-muted line-through' :
                  active  ? 'text-dome-text' :
                            'text-dome-muted',
                ].join(' ')}>
                  {s.label}
                </p>
                {active && (
                  <p className="mt-0.5 text-xs text-dome-muted">{s.detail}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
