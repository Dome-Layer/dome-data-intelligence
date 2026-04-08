'use client'

import { useState, useRef, useEffect } from 'react'
import type { ConversationTurn, ColumnClassification, ColumnSummary } from '@/lib/types'
import { askQuestion, APIError } from '@/lib/api'
import QAMessage from './QAMessage'

interface QAPanelProps {
  sessionId: string
  columnSummary: ColumnSummary[]
  classifications: ColumnClassification[]
  dataContext?: string
}

interface ConversationTurnWithMeta extends ConversationTurn {
  columnsReferenced?: string[]
  confidence?: number
}

// Defined outside the component so their identity is stable across renders.
function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin-slow" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={['h-4 w-4 text-dome-muted transition-transform', open ? 'rotate-180' : ''].join(' ')}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function QAPanel({ sessionId, columnSummary, classifications, dataContext }: QAPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [conversation, setConversation] = useState<ConversationTurnWithMeta[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const desktopListRef = useRef<HTMLDivElement>(null)
  const mobileListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;[desktopListRef, mobileListRef].forEach((ref) => {
      if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
    })
  }, [conversation, loading])

  async function send() {
    const question = input.trim()
    if (!question || loading) return

    const userTurn: ConversationTurnWithMeta = { role: 'user', content: question }
    const updated = [...conversation, userTurn]
    setConversation(updated)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await askQuestion({
        session_id: sessionId,
        question,
        conversation_history: conversation.map(({ role, content }) => ({ role, content })),
        column_summary: columnSummary,
        classifications,
        data_context: dataContext,
      })
      setConversation([
        ...updated,
        {
          role: 'assistant',
          content: res.answer,
          columnsReferenced: res.columns_referenced,
          confidence: res.confidence,
        },
      ])
    } catch (err) {
      setError(err instanceof APIError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  // ── Shared JSX blocks (variables, not components — avoids unmount on re-render) ──

  const messageList = (listRef: React.RefObject<HTMLDivElement>) => (
    <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {conversation.length === 0 ? (
        <p className="pt-4 text-center font-mono text-xs text-dome-tertiary">
          Ask anything about your dataset — column statistics, patterns, or summaries.
        </p>
      ) : (
        conversation.map((turn, i) => (
          <QAMessage
            key={i}
            role={turn.role}
            content={turn.content}
            columnsReferenced={turn.columnsReferenced}
            confidence={turn.confidence}
          />
        ))
      )}
      {loading && (
        <div className="flex justify-start">
          <div className="rounded-lg bg-dome-elevated px-4 py-3">
            <Spinner />
          </div>
        </div>
      )}
    </div>
  )

  const errorBanner = error ? (
    <div className="mx-3 mb-2 flex items-start gap-2 rounded border border-dome-error-border bg-dome-error-subtle px-3 py-2 text-xs text-dome-error">
      <span className="flex-1">{error}</span>
      <button onClick={() => setError(null)} className="shrink-0 font-medium hover:opacity-70">✕</button>
    </div>
  ) : null

  const inputArea = (
    <div className="shrink-0 border-t border-dome-border px-3 py-3">
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Ask a question… (Enter to send)"
          rows={2}
          className="flex-1 resize-none rounded border border-dome-border bg-dome-bg px-3 py-2 font-sans text-sm text-dome-text placeholder-dome-tertiary outline-none focus:border-dome-border-accent disabled:opacity-50"
        />
        <button
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          className="flex h-9 w-16 items-center justify-center rounded bg-dome-accent text-xs font-medium text-white hover:bg-dome-accent-hover disabled:opacity-40"
        >
          {loading ? <Spinner /> : 'Send'}
        </button>
      </div>
    </div>
  )

  const unreadCount = conversation.filter((t) => t.role === 'assistant').length

  return (
    <>
      {/* ── Desktop sidebar (lg+) — fixed right panel ── */}
      <div className="fixed right-0 top-16 hidden h-[calc(100vh-4rem)] w-[380px] flex-col border-l border-dome-border bg-dome-surface shadow-sm lg:flex">
        <div className="shrink-0 border-b border-dome-border px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-widest text-dome-muted">
            Ask about your data
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-dome-tertiary">
            Based on column statistics — raw rows never sent to AI
          </p>
        </div>
        {messageList(desktopListRef)}
        {errorBanner}
        {inputArea}
      </div>

      {/* ── Mobile bottom sheet (< lg) — fixed bottom ── */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-dome-border bg-dome-surface shadow-xl lg:hidden">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-dome-muted">
            Ask about your data
            {unreadCount > 0 && !mobileOpen && (
              <span className="rounded-full bg-dome-accent px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
                {unreadCount}
              </span>
            )}
          </span>
          <ChevronIcon open={mobileOpen} />
        </button>

        {mobileOpen && (
          <div className="flex max-h-[60vh] flex-col border-t border-dome-border">
            {messageList(mobileListRef)}
            {errorBanner}
            {inputArea}
          </div>
        )}
      </div>
    </>
  )
}
