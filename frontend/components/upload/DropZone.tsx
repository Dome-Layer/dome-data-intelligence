'use client'

import { useCallback, useRef, useState } from 'react'
import type { ParsedFile } from '@/lib/types'
import { parseFile } from '@/lib/fileParser'

interface DropZoneProps {
  onParsed: (file: ParsedFile) => void
  onError: (message: string) => void
  disabled?: boolean
}

const ACCEPT = '.csv,.xlsx,.xls,.xlsm,.xlsb'

export default function DropZone({ onParsed, onError, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = useCallback(
    async (file: File) => {
      try {
        const parsed = await parseFile(file)
        onParsed(parsed)
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to parse file')
      }
    },
    [onParsed, onError],
  )

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const file = e.dataTransfer.files[0]
      if (file) handle(file)
    },
    [disabled, handle],
  )

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }
  const onDragLeave = () => setIsDragging(false)

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handle(file)
    // reset so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <label
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={[
        'flex w-full cursor-pointer flex-col items-center justify-center gap-4',
        'rounded-xl border-2 border-dashed px-8 py-14',
        'transition-colors duration-150',
        disabled
          ? 'cursor-not-allowed border-dome-border opacity-50'
          : isDragging
          ? 'border-dome-accent bg-dome-accent-subtle'
          : 'border-dome-border bg-dome-surface hover:border-dome-border-accent hover:bg-dome-elevated',
      ].join(' ')}
    >
      {/* Upload icon */}
      <svg
        className={[
          'h-10 w-10 transition-colors',
          isDragging ? 'text-dome-accent' : 'text-dome-muted',
        ].join(' ')}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        <polyline points="16 11 12 7 8 11" />
        <line x1="12" y1="7" x2="12" y2="17" />
      </svg>

      <div className="text-center">
        <p className="text-base font-medium text-dome-text">
          {isDragging ? 'Drop it here' : 'Drop your spreadsheet here'}
        </p>
        <p className="mt-1 text-sm text-dome-muted">
          CSV · XLSX · XLS · XLSM · XLSB
        </p>
      </div>

      <span className="rounded-lg border border-dome-border bg-dome-elevated px-4 py-2 text-sm font-medium text-dome-text transition-colors hover:border-dome-border-accent hover:text-dome-accent">
        Browse files
      </span>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={onChange}
        className="sr-only"
        disabled={disabled}
      />
    </label>
  )
}
