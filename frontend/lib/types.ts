// Column types
export type ColumnType = 'date' | 'ordered_category' | 'category' | 'metric'
export type ChartType = 'line' | 'bar' | 'kpi' | 'histogram' | 'donut' | 'summary_table' | 'scatter'
export type HumanInLoop = 'not_required' | 'recommended' | 'required' | 'completed'
export type ConversationRole = 'user' | 'assistant'

// Column summary — produced by fileParser.ts, sent to /upload
export interface ColumnSummary {
  name: string
  dtype: string
  unique_count: number
  null_count: number
  sample_values: string[]
  min: number | null
  max: number | null
  mean: number | null
}

// Upload
export interface UploadRequest {
  filename: string
  row_count: number
  column_summary: ColumnSummary[]
}

export interface UploadResponse {
  session_id: string
  filename: string
  row_count: number
  column_count: number
  column_summary: ColumnSummary[]
  parse_warnings: string[]
}

// Classification
export interface ColumnClassification {
  column_name: string
  classified_type: ColumnType
  unique_count: number
  can_be_negative: boolean
  is_ordinal: boolean
  unit: string | null
  note: string | null
  aggregation_hint?: 'sum' | 'last'  // "last" for snapshot metrics (balance, price, rate)
}

// Charts
export interface ChartConfig {
  chart_id: string
  rule_id: string
  chart_type: ChartType
  title: string
  x_column: string | null
  y_column: string | null
  color_column: string | null
  secondary_y_column: string | null
}

// Governance
export interface GovernanceEvent {
  agent_id: string
  action_type: string
  timestamp: string
  input_hash: string
  input_type: string
  output_summary: string
  rules_applied: string[]
  rules_triggered: string[]
  confidence: number | null
  human_in_loop: HumanInLoop
  user_id: string | null
  metadata: Record<string, unknown>
}

// Dashboard
export interface DashboardRequest {
  session_id: string
  column_summary: ColumnSummary[]
}

export interface DashboardResponse {
  session_id: string
  classifications: ColumnClassification[]
  charts: ChartConfig[]
  governance: GovernanceEvent
}

// Q&A
export interface ConversationTurn {
  role: ConversationRole
  content: string
}

export interface QARequest {
  session_id: string
  question: string
  conversation_history: ConversationTurn[]
  column_summary?: ColumnSummary[]
  classifications?: ColumnClassification[]
  data_context?: string  // pre-computed aggregations from raw rows (client-side)
}

export interface QAResponse {
  answer: string
  columns_referenced: string[]
  confidence: number
  human_in_loop: HumanInLoop
  governance: GovernanceEvent
}

// Client-side only — never sent to backend
export type DataRow = Record<string, string | number | null>

export interface ParsedFile {
  filename: string
  rowCount: number
  columnSummary: ColumnSummary[]
  rows: DataRow[]
  loadedSheets: string[]   // sheets whose rows were merged into this dataset
  skippedSheets: string[]  // sheets that existed but had incompatible column schema
}

export interface SortState {
  column: string
  direction: 'asc' | 'desc'
}
