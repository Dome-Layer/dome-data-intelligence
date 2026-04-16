'use client'

import { useState, useMemo } from 'react'
import type { DataRow } from '@/lib/types'

interface DataTableProps {
  rows: DataRow[]
  filename: string
  highlightColumns?: string[]
}

const PAGE_SIZE = 50

export default function DataTable({
  rows,
  filename,
  highlightColumns = [],
}: DataTableProps) {
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})

  const columns = useMemo(() => {
    if (rows.length === 0) return []
    return Object.keys(rows[0])
  }, [rows])

  const filtered = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v.trim() !== '')
    if (active.length === 0) return rows
    return rows.filter((row) =>
      active.every(([col, term]) => {
        const v = row[col]
        if (v == null) return false
        return String(v).toLowerCase().includes(term.toLowerCase())
      }),
    )
  }, [rows, filters])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sort.column]
      const bv = b[sort.column]
      let cmp = 0
      if (av == null && bv == null) cmp = 0
      else if (av == null) cmp = 1
      else if (bv == null) cmp = -1
      else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv))
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }, [filtered, sort])

  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE
    return sorted.slice(start, start + PAGE_SIZE)
  }, [sorted, page])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const startRow = page * PAGE_SIZE + 1
  const endRow = Math.min((page + 1) * PAGE_SIZE, filtered.length)
  const hasActiveFilters = Object.values(filters).some((v) => v.trim() !== '')

  function toggleSort(col: string) {
    setSort((prev) => {
      if (!prev || prev.column !== col) return { column: col, direction: 'asc' }
      if (prev.direction === 'asc') return { column: col, direction: 'desc' }
      return null
    })
    setPage(0)
  }

  function setFilter(col: string, value: string) {
    setFilters((prev) => ({ ...prev, [col]: value }))
    setPage(0)
  }

  function clearFilters() {
    setFilters({})
    setPage(0)
  }

  function downloadCSV() {
    if (columns.length === 0) return
    const source = hasActiveFilters ? filtered : rows
    const header = columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')
    const body = source.map((row) =>
      columns
        .map((c) => {
          const v = row[c]
          if (v == null) return ''
          if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`
          return String(v)
        })
        .join(','),
    )
    const csv = [header, ...body].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.replace(/\.[^.]+$/, '') + '_data.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (rows.length === 0) return null

  const highlightSet = new Set(highlightColumns)

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-dome-muted">
          Raw Data{' '}
          {hasActiveFilters
            ? `(${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} rows)`
            : `(${rows.length.toLocaleString()} rows)`}
        </span>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="rounded border border-dome-warning-border px-3 py-1 text-xs text-dome-warning hover:border-dome-border-accent hover:text-dome-text"
            >
              Clear filters
            </button>
          )}
          <button
            onClick={downloadCSV}
            className="rounded border border-dome-border px-3 py-1 text-xs text-dome-muted hover:border-dome-border-accent hover:text-dome-accent"
          >
            {hasActiveFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-dome-border">
        <table className="w-full text-sm">
          <thead>
            {/* Column headers */}
            <tr className="border-b border-dome-border bg-dome-elevated">
              {columns.map((col) => {
                const isHighlighted = highlightSet.has(col)
                const isActive = sort?.column === col
                return (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    className={[
                      'cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left font-mono text-xs font-medium',
                      'hover:text-dome-text',
                      isHighlighted
                        ? 'border-b-2 border-dome-accent text-dome-accent'
                        : 'text-dome-muted',
                    ].join(' ')}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      {isActive && (
                        <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
                          {sort!.direction === 'asc' ? (
                            <path d="M6 2l4 7H2l4-7z" />
                          ) : (
                            <path d="M6 10L2 3h8l-4 7z" />
                          )}
                        </svg>
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
            {/* Filter row */}
            <tr className="border-b border-dome-border bg-dome-surface">
              {columns.map((col) => {
                const isHighlighted = highlightSet.has(col)
                return (
                  <td
                    key={col}
                    className={['px-2 py-1', isHighlighted ? 'bg-dome-accent-subtle/20' : ''].join(' ')}
                  >
                    <input
                      type="text"
                      value={filters[col] ?? ''}
                      onChange={(e) => setFilter(col, e.target.value)}
                      placeholder="Filter…"
                      className="w-full min-w-[80px] rounded border border-dome-border bg-dome-elevated px-2 py-0.5 font-mono text-xs text-dome-text placeholder:text-dome-tertiary focus:border-dome-border-accent focus:outline-none"
                    />
                  </td>
                )
              })}
            </tr>
          </thead>
          <tbody className="bg-dome-surface">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center font-mono text-xs text-dome-muted"
                >
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-dome-border last:border-0 hover:bg-dome-elevated"
                >
                  {columns.map((col) => {
                    const isHighlighted = highlightSet.has(col)
                    return (
                      <td
                        key={col}
                        className={[
                          'whitespace-nowrap px-3 py-1.5 font-mono text-xs text-dome-text',
                          isHighlighted ? 'bg-dome-accent-subtle/40' : '',
                        ].join(' ')}
                      >
                        {row[col] == null ? (
                          <span className="text-dome-tertiary">—</span>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-dome-muted">
            Showing {startRow}–{endRow} of {filtered.length.toLocaleString()} rows
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="rounded border border-dome-border px-2.5 py-1 text-xs text-dome-muted disabled:opacity-40 hover:border-dome-border-accent hover:text-dome-text"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
              className="rounded border border-dome-border px-2.5 py-1 text-xs text-dome-muted disabled:opacity-40 hover:border-dome-border-accent hover:text-dome-text"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Zero-retention disclosure */}
      <p className="governance-banner text-center">
        Your data has not been uploaded — all rows are processed locally in your browser
      </p>
    </div>
  )
}
