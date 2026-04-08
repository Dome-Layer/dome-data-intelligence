import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { ColumnSummary, ParsedFile, DataRow } from '@/lib/types'

const SUPPORTED_EXTENSIONS = ['csv', 'xlsx', 'xls', 'xlsm', 'xlsb']

function inferDtype(values: unknown[]): 'float64' | 'int64' | 'object' {
  const nonNull = values.filter(
    (v) => v !== null && v !== undefined && v !== '',
  )
  if (nonNull.length === 0) return 'object'

  const allNumeric = nonNull.every(
    (v) =>
      typeof v === 'number' ||
      (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))),
  )
  if (!allNumeric) return 'object'

  const nums = nonNull.map((v) => (typeof v === 'number' ? v : Number(v)))
  return nums.some((n) => !Number.isInteger(n)) ? 'float64' : 'int64'
}

function extractColumnSummary(
  rows: DataRow[],
  columns: string[],
): ColumnSummary[] {
  return columns.map((col) => {
    const values = rows.map((r) => r[col])
    const nonNull = values.filter(
      (v) => v !== null && v !== undefined && v !== '',
    ) as (string | number)[]
    const nullCount = values.length - nonNull.length
    const dtype = inferDtype(values)

    // Unique count
    const uniqueSet = new Set(nonNull.map(String))
    const uniqueCount = uniqueSet.size

    // First 3 distinct non-null values in original order
    const seen = new Set<string>()
    const sampleValues: string[] = []
    for (const row of rows) {
      const v = row[col]
      if (v !== null && v !== undefined && v !== '') {
        const s = String(v)
        if (!seen.has(s)) {
          seen.add(s)
          sampleValues.push(s)
          if (sampleValues.length === 3) break
        }
      }
    }

    let min: number | null = null
    let max: number | null = null
    let mean: number | null = null

    if (dtype === 'float64' || dtype === 'int64') {
      const nums = nonNull
        .map(Number)
        .filter((n) => !isNaN(n))
      if (nums.length > 0) {
        min = Math.min(...nums)
        max = Math.max(...nums)
        mean =
          Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) /
          100
      }
    }

    return {
      name: col,
      dtype,
      unique_count: uniqueCount,
      null_count: nullCount,
      sample_values: sampleValues,
      min,
      max,
      mean,
    }
  })
}

async function parseCsv(file: File): Promise<DataRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<DataRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => resolve(result.data),
      error: (err) => reject(new Error(err.message)),
    })
  })
}

function normaliseRow(row: Record<string, unknown>): DataRow {
  const out: DataRow = {}
  for (const [key, val] of Object.entries(row)) {
    if (val instanceof Date) {
      // Use local date parts — toISOString() is UTC and causes off-by-one in non-UTC timezones
      const y = val.getFullYear()
      const m = String(val.getMonth() + 1).padStart(2, '0')
      const d = String(val.getDate()).padStart(2, '0')
      out[key] = `${y}-${m}-${d}`
    } else if (val === null || val === undefined) {
      out[key] = null
    } else if (typeof val === 'number' || typeof val === 'string') {
      out[key] = val
    } else {
      out[key] = String(val)
    }
  }
  return out
}

interface ExcelParseResult {
  rows: DataRow[]
  loadedSheets: string[]
  skippedSheets: string[]
}

async function parseExcel(file: File): Promise<ExcelParseResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  if (workbook.SheetNames.length === 0) throw new Error('Workbook contains no sheets')

  // Parse every non-empty sheet
  const parsed = workbook.SheetNames
    .map((name) => {
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[name],
        { defval: null },
      )
      const rows = raw.map(normaliseRow)
      const columns = rows.length > 0 ? Object.keys(rows[0]).join('|') : ''
      return { name, rows, columnKey: columns }
    })
    .filter((s) => s.rows.length > 0 && s.columnKey !== '')

  if (parsed.length === 0) throw new Error('No data found in any sheet')

  // Group sheets by column schema (column names in order)
  const groups = new Map<string, typeof parsed>()
  for (const sheet of parsed) {
    const existing = groups.get(sheet.columnKey) ?? []
    existing.push(sheet)
    groups.set(sheet.columnKey, existing)
  }

  // Pick the largest schema group — merge all its sheets
  let best: typeof parsed = []
  for (const group of groups.values()) {
    if (group.length > best.length || (group.length === best.length &&
        group.reduce((n, s) => n + s.rows.length, 0) >
        best.reduce((n, s) => n + s.rows.length, 0))) {
      best = group
    }
  }

  const loadedNames = new Set(best.map((s) => s.name))
  const skipped = parsed.filter((s) => !loadedNames.has(s.name)).map((s) => s.name)

  return {
    rows: best.flatMap((s) => s.rows),
    loadedSheets: best.map((s) => s.name),
    skippedSheets: skipped,
  }
}

// Read the first 8 bytes to detect real file format regardless of extension.
// XLSX/XLSB/XLS all start with a known magic sequence.
async function detectIsExcel(file: File): Promise<boolean> {
  const slice = file.slice(0, 8)
  const buf = await slice.arrayBuffer()
  const bytes = new Uint8Array(buf)
  // XLSX / XLSM / XLSB / DOCX etc. (ZIP-based): PK\x03\x04
  const isPkZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  // Legacy XLS (OLE2 Compound Document): D0 CF 11 E0
  const isOle2 = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
  return isPkZip || isOle2
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported file type: .${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    )
  }

  // Detect actual format by magic bytes — handles .csv files that are really Excel
  const isExcel = ext !== 'csv' || (await detectIsExcel(file))

  let rows: DataRow[]
  let loadedSheets: string[] = []
  let skippedSheets: string[] = []

  if (isExcel) {
    const result = await parseExcel(file)
    rows = result.rows
    loadedSheets = result.loadedSheets
    skippedSheets = result.skippedSheets
  } else {
    rows = await parseCsv(file)
  }

  if (rows.length === 0) throw new Error('File contains no data rows')

  const columns = Object.keys(rows[0])
  if (columns.length === 0) throw new Error('File contains no columns')

  const columnSummary = extractColumnSummary(rows, columns)

  return {
    filename: file.name,
    rowCount: rows.length,
    columnSummary,
    rows,
    loadedSheets,
    skippedSheets,
  }
}

export async function loadDemoFile(filename: string): Promise<File> {
  const res = await fetch(`/demo/${filename}`)
  if (!res.ok) throw new Error(`Failed to load demo file: ${filename}`)
  const blob = await res.blob()
  return new File([blob], filename, { type: 'text/csv' })
}
