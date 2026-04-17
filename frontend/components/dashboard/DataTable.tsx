'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import type { DataRow, ColumnClassification } from '@/lib/types'

interface DataTableProps {
  rows: DataRow[]
  filename: string
  highlightColumns?: string[]
  showCsvDownload?: boolean
  classifications?: ColumnClassification[]
}

const PAGE_SIZE = 50
const DROPDOWN_MAX = 50

// ── Filter state ─────────────────────────────────────────────────────────────

type ColumnFilter =
  | { mode: 'text'; value: string }
  | { mode: 'values'; values: Set<string> }
  | { mode: 'range'; min: string; max: string }

function isActive(f: ColumnFilter | undefined): boolean {
  if (!f) return false
  switch (f.mode) {
    case 'text':   return f.value.trim() !== ''
    case 'values': return f.values.size > 0
    case 'range':  return f.min.trim() !== '' || f.max.trim() !== ''
  }
}

function rowMatchesFilter(cellValue: unknown, filter: ColumnFilter | undefined): boolean {
  if (!filter || !isActive(filter)) return true
  const v = cellValue == null ? '' : String(cellValue)
  switch (filter.mode) {
    case 'text':
      return v.toLowerCase().includes(filter.value.toLowerCase())
    case 'values':
      return filter.values.has(v)
    case 'range': {
      const n = Number(v)
      const lo = filter.min === '' ? -Infinity : Number(filter.min)
      const hi = filter.max === '' ? Infinity : Number(filter.max)
      return isNaN(n) ? true : n >= lo && n <= hi
    }
  }
}

// ── Multi-select dropdown ─────────────────────────────────────────────────────

interface MultiSelectProps {
  allValues: string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  isHighlighted: boolean
}

function MultiSelect({ allValues, selected, onChange, isHighlighted }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const visible = useMemo(
    () =>
      search.trim()
        ? allValues.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
        : allValues,
    [allValues, search],
  )

  function toggle(v: string) {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange(next)
  }

  const label =
    selected.size === 0
      ? 'All'
      : selected.size === 1
      ? [...selected][0] || '(empty)'
      : `${selected.size} selected`

  return (
    <div ref={containerRef} className="relative w-full min-w-[80px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex w-full items-center justify-between gap-1 rounded border px-2 py-0.5 font-mono text-xs',
          selected.size > 0
            ? 'border-dome-accent text-dome-accent'
            : 'border-dome-border text-dome-muted hover:border-dome-border-accent',
          isHighlighted ? 'bg-dome-accent-subtle/20' : 'bg-dome-elevated',
        ].join(' ')}
      >
        <span className="max-w-[100px] truncate">{label}</span>
        <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
          <path d={open ? 'M6 4l5 5H1l5-5z' : 'M6 8L1 3h10L6 8z'} />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[200] mt-1 w-56 rounded-lg border border-dome-border bg-dome-surface shadow-xl">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search values…"
              autoFocus
              className="w-full rounded border border-dome-border bg-dome-elevated px-2 py-1 font-mono text-xs text-dome-text placeholder:text-dome-tertiary focus:border-dome-border-accent focus:outline-none"
            />
          </div>

          <div className="max-h-52 overflow-y-auto border-t border-dome-border">
            {visible.length === 0 ? (
              <p className="px-3 py-2 font-mono text-xs text-dome-tertiary">No matches</p>
            ) : (
              visible.map((v) => (
                <label
                  key={v}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 font-mono text-xs text-dome-text hover:bg-dome-elevated"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(v)}
                    onChange={() => toggle(v)}
                    className="accent-dome-accent"
                  />
                  <span className="truncate">{v || '(empty)'}</span>
                </label>
              ))
            )}
          </div>

          {selected.size > 0 && (
            <div className="border-t border-dome-border p-2">
              <button
                onClick={() => { onChange(new Set()); setOpen(false); setSearch('') }}
                className="w-full rounded border border-dome-warning-border py-1 font-mono text-xs text-dome-warning hover:bg-dome-warning-subtle"
              >
                Clear ({selected.size})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Range filter ──────────────────────────────────────────────────────────────

interface RangeFilterProps {
  min: string
  max: string
  onMin: (v: string) => void
  onMax: (v: string) => void
  isHighlighted: boolean
}

function RangeFilter({ min, max, onMin, onMax, isHighlighted }: RangeFilterProps) {
  return (
    <div
      className={[
        'flex items-center gap-1',
        isHighlighted ? 'bg-dome-accent-subtle/20' : '',
      ].join(' ')}
    >
      <input
        type="number"
        value={min}
        onChange={(e) => onMin(e.target.value)}
        placeholder="Min"
        className="w-[64px] rounded border border-dome-border bg-dome-elevated px-1.5 py-0.5 font-mono text-xs text-dome-text placeholder:text-dome-tertiary focus:border-dome-border-accent focus:outline-none"
      />
      <span className="text-xs text-dome-tertiary">–</span>
      <input
        type="number"
        value={max}
        onChange={(e) => onMax(e.target.value)}
        placeholder="Max"
        className="w-[64px] rounded border border-dome-border bg-dome-elevated px-1.5 py-0.5 font-mono text-xs text-dome-text placeholder:text-dome-tertiary focus:border-dome-border-accent focus:outline-none"
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DataTable({
  rows,
  filename,
  highlightColumns = [],
  showCsvDownload = false,
  classifications,
}: DataTableProps) {
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null)
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({})

  const columns = useMemo(() => {
    if (rows.length === 0) return []
    return Object.keys(rows[0])
  }, [rows])

  const classByName = useMemo(
    () =>
      Object.fromEntries((classifications ?? []).map((c) => [c.column_name, c])),
    [classifications],
  )

  // Unique sorted values per column (computed once from all rows, for dropdowns)
  const uniqueValues = useMemo(() => {
    const result: Record<string, string[]> = {}
    for (const col of columns) {
      const vals = new Set<string>()
      for (const row of rows) {
        vals.add(row[col] == null ? '' : String(row[col]))
      }
      result[col] = [...vals].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    }
    return result
  }, [rows, columns])

  function filterModeFor(col: string): 'text' | 'values' | 'range' {
    if (!classifications) return 'text'
    const cls = classByName[col]?.classified_type
    if (cls === 'metric') return 'range'
    if ((cls === 'category' || cls === 'ordered_category') && (uniqueValues[col]?.length ?? 0) <= DROPDOWN_MAX) {
      return 'values'
    }
    return 'text'
  }

  const filtered = useMemo(() => {
    const active = Object.entries(filters).filter(([, f]) => isActive(f))
    if (active.length === 0) return rows
    return rows.filter((row) =>
      active.every(([col, f]) => rowMatchesFilter(row[col], f)),
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
  const hasActiveFilters = Object.values(filters).some(isActive)

  function toggleSort(col: string) {
    setSort((prev) => {
      if (!prev || prev.column !== col) return { column: col, direction: 'asc' }
      if (prev.direction === 'asc') return { column: col, direction: 'desc' }
      return null
    })
    setPage(0)
  }

  function setFilter(col: string, update: Partial<ColumnFilter> | ColumnFilter) {
    setFilters((prev) => {
      const mode = filterModeFor(col)
      const current = prev[col] ?? (
        mode === 'text' ? { mode: 'text', value: '' } :
        mode === 'values' ? { mode: 'values', values: new Set<string>() } :
        { mode: 'range', min: '', max: '' }
      )
      return { ...prev, [col]: { ...current, ...update } as ColumnFilter }
    })
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
          {hasActiveFilters
            ? `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} rows`
            : `${rows.length.toLocaleString()} rows`}
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
          {showCsvDownload && (
            <button
              onClick={downloadCSV}
              className="rounded border border-dome-border px-3 py-1 text-xs text-dome-muted hover:border-dome-border-accent hover:text-dome-accent"
            >
              {hasActiveFilters ? 'Download filtered CSV' : 'Download CSV'}
            </button>
          )}
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
                const mode = filterModeFor(col)
                const f = filters[col]

                return (
                  <td
                    key={col}
                    className={['px-2 py-1', isHighlighted ? 'bg-dome-accent-subtle/20' : ''].join(' ')}
                  >
                    {mode === 'values' ? (
                      <MultiSelect
                        allValues={uniqueValues[col] ?? []}
                        selected={(f?.mode === 'values' ? f.values : undefined) ?? new Set()}
                        onChange={(values) => setFilter(col, { mode: 'values', values })}
                        isHighlighted={isHighlighted}
                      />
                    ) : mode === 'range' ? (
                      <RangeFilter
                        min={f?.mode === 'range' ? f.min : ''}
                        max={f?.mode === 'range' ? f.max : ''}
                        onMin={(v) => setFilter(col, { mode: 'range', min: v, max: f?.mode === 'range' ? f.max : '' })}
                        onMax={(v) => setFilter(col, { mode: 'range', min: f?.mode === 'range' ? f.min : '', max: v })}
                        isHighlighted={isHighlighted}
                      />
                    ) : (
                      <input
                        type="text"
                        value={f?.mode === 'text' ? f.value : ''}
                        onChange={(e) => setFilter(col, { mode: 'text', value: e.target.value })}
                        placeholder="Filter…"
                        className="w-full min-w-[80px] rounded border border-dome-border bg-dome-elevated px-2 py-0.5 font-mono text-xs text-dome-text placeholder:text-dome-tertiary focus:border-dome-border-accent focus:outline-none"
                      />
                    )}
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
    </div>
  )
}
