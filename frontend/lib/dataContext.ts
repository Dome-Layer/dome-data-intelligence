import type { DataRow, ColumnClassification } from './types'

const MAX_GROUPS = 50  // cap per breakdown to keep prompt size reasonable

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

/**
 * Compute structured aggregations from raw rows entirely client-side.
 * Returns a plain-text block that the LLM can use to answer quantitative questions.
 * Raw rows never leave the browser — only these pre-computed numbers are sent.
 */
export function computeDataContext(
  rows: DataRow[],
  classifications: ColumnClassification[],
): string {
  if (rows.length === 0 || classifications.length === 0) return ''

  const metrics   = classifications.filter((c) => c.classified_type === 'metric')
  const cats      = classifications.filter(
    (c) => c.classified_type === 'category' || c.classified_type === 'ordered_category',
  )
  const dates     = classifications.filter((c) => c.classified_type === 'date')

  const sections: string[] = [`Total rows: ${rows.length}`]

  // ── Metric totals ──────────────────────────────────────────────────────────
  for (const m of metrics) {
    let total = 0
    let count = 0
    for (const row of rows) {
      const v = Number(row[m.column_name])
      if (!isNaN(v)) { total += v; count++ }
    }
    const unit = m.unit ? ` ${m.unit}` : ''
    sections.push(`Total ${m.column_name}: ${fmt(total)}${unit} (${count} non-null values)`)
  }

  // ── Metric × category breakdowns ──────────────────────────────────────────
  for (const cat of cats) {
    for (const m of metrics) {
      const groups: Record<string, number> = {}
      for (const row of rows) {
        const key = row[cat.column_name] != null ? String(row[cat.column_name]) : '(blank)'
        const v   = Number(row[m.column_name])
        if (!isNaN(v)) groups[key] = (groups[key] ?? 0) + v
      }
      const sorted = Object.entries(groups)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_GROUPS)
      const unit = m.unit ? ` ${m.unit}` : ''
      const lines = sorted.map(([k, v]) => `  ${k}: ${fmt(v)}${unit}`)
      sections.push(`${m.column_name} by ${cat.column_name}:\n${lines.join('\n')}`)
    }
  }

  // ── Metric × month (from date columns) ────────────────────────────────────
  for (const d of dates) {
    for (const m of metrics) {
      const months: Record<string, number> = {}
      for (const row of rows) {
        const dateStr  = String(row[d.column_name] ?? '')
        const monthKey = dateStr.slice(0, 7)          // YYYY-MM
        if (!/^\d{4}-\d{2}$/.test(monthKey)) continue
        const v = Number(row[m.column_name])
        if (!isNaN(v)) months[monthKey] = (months[monthKey] ?? 0) + v
      }
      if (Object.keys(months).length === 0) continue
      const sorted = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]))
      const unit   = m.unit ? ` ${m.unit}` : ''
      const lines  = sorted.map(([k, v]) => `  ${k}: ${fmt(v)}${unit}`)
      sections.push(`${m.column_name} by month (${d.column_name}):\n${lines.join('\n')}`)
    }
  }

  // ── Metric × category × month (three-way, only when ≤3 categories and date exists) ──
  if (dates.length > 0 && cats.length > 0) {
    for (const d of dates) {
      for (const cat of cats.filter((c) => c.unique_count <= 20)) {
        for (const m of metrics) {
          const grid: Record<string, Record<string, number>> = {}
          for (const row of rows) {
            const dateStr  = String(row[d.column_name] ?? '')
            const monthKey = dateStr.slice(0, 7)
            if (!/^\d{4}-\d{2}$/.test(monthKey)) continue
            const catKey = row[cat.column_name] != null ? String(row[cat.column_name]) : '(blank)'
            const v      = Number(row[m.column_name])
            if (isNaN(v)) continue
            if (!grid[monthKey]) grid[monthKey] = {}
            grid[monthKey][catKey] = (grid[monthKey][catKey] ?? 0) + v
          }
          if (Object.keys(grid).length === 0) continue
          const months = Object.keys(grid).sort()
          const lines  = months.map((mo) => {
            const bycat = Object.entries(grid[mo])
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => `${k}: ${fmt(v)}`)
              .join(', ')
            return `  ${mo}: ${bycat}`
          })
          sections.push(
            `${m.column_name} by month × ${cat.column_name}:\n${lines.join('\n')}`,
          )
        }
      }
    }
  }

  return sections.join('\n\n')
}
