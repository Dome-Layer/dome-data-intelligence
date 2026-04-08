import type { ConversationRole } from '@/lib/types'

interface QAMessageProps {
  role: ConversationRole
  content: string
  columnsReferenced?: string[]
  confidence?: number
}

export default function QAMessage({
  role,
  content,
  columnsReferenced = [],
  confidence,
}: QAMessageProps) {
  const isUser = role === 'user'

  return (
    <div className={['flex', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      <div
        className={[
          'max-w-[80%] rounded-lg px-4 py-3 text-sm text-dome-text',
          isUser ? 'bg-dome-accent-subtle' : 'bg-dome-elevated',
        ].join(' ')}
      >
        <p className="whitespace-pre-wrap">{content}</p>

        {!isUser && columnsReferenced.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {columnsReferenced.map((col) => (
              <span
                key={col}
                className="rounded px-1.5 py-0.5 font-mono text-[10px] text-dome-accent ring-1 ring-dome-border-accent"
              >
                {col}
              </span>
            ))}
          </div>
        )}

        {!isUser && confidence != null && (
          <p className="mt-1.5 font-mono text-[11px] text-dome-muted">
            {Math.round(confidence * 100)}% confidence
          </p>
        )}
      </div>
    </div>
  )
}
