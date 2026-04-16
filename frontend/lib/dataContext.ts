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

  // ── Row count per category ─────────────────────────────────────────────────
  // Provides per-group order/record counts so the LLM never conflates the
  // global "Total rows" with the count for a specific group.
  for (const cat of cats) {
    const counts: Record<string, number> = {}
    for (const row of rows) {
      const key = row[cat.column_name] != null ? String(row[cat.column_name]) : '(blank)'
      counts[key] = (counts[key] ?? 0) + 1
    }
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_GROUPS)
    const lines = sorted.map(([k, v]) => `  ${k}: ${v}`)
    sections.push(`Row count by ${cat.column_name}:\n${lines.join('\n')}`)
  }

  // ── Unique category values per group ───────────────────────────────────────
  // For each low-cardinality category pair, shows how many distinct values of
  // the inner column exist per outer-column group (e.g. "Unique Customer_ID per
  // Region: South: 1"). Lets the LLM say "exclusively" vs "primarily".
  for (const outer of cats.filter((c) => c.unique_count <= 20)) {
    for (const inner of cats.filter((c) => c.column_name !== outer.column_name)) {
      const unique: Record<string, Set<string>> = {}
      for (const row of rows) {
        const ok = row[outer.column_name] != null ? String(row[outer.column_name]) : '(blank)'
        const ik = row[inner.column_name] != null ? String(row[inner.column_name]) : '(blank)'
        if (!unique[ok]) unique[ok] = new Set()
        unique[ok].add(ik)
      }
      const sorted = Object.entries(unique)
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, MAX_GROUPS)
      const lines = sorted.map(([k, s]) => `  ${k}: ${s.size}`)
      sections.push(`Unique ${inner.column_name} per ${outer.column_name}:\n${lines.join('\n')}`)
    }
  }

  // ── Metric × category breakdowns ──────────────────────────────────────────
  // Each line shows both the group SUM and the average per row so the LLM
  // never mistakes a sum of rate/ratio values for an average.
  for (const cat of cats) {
    for (const m of metrics) {
      const groups: Record<string, { sum: number; count: number }> = {}
      for (const row of rows) {
        const key = row[cat.column_name] != null ? String(row[cat.column_name]) : '(blank)'
        const v   = Number(row[m.column_name])
        if (!isNaN(v)) {
          if (!groups[key]) groups[key] = { sum: 0, count: 0 }
          groups[key].sum   += v
          groups[key].count += 1
        }
      }
      const sorted = Object.entries(groups)
        .sort((a, b) => b[1].sum - a[1].sum)
        .slice(0, MAX_GROUPS)
      const unit  = m.unit ? ` ${m.unit}` : ''
      const lines = sorted.map(([k, { sum, count }]) =>
        `  ${k}: ${fmt(sum)}${unit} (avg per row: ${fmt(sum / count)}${unit})`,
      )
      sections.push(`${m.column_name} by ${cat.column_name} (sum · avg per row):\n${lines.join('\n')}`)
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

  // ── Metric × category × month (three-way, only when ≤20 categories and date exists) ──
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
