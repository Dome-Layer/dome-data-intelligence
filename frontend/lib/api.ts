import type {
  UploadRequest,
  UploadResponse,
  DashboardRequest,
  DashboardResponse,
  QARequest,
  QAResponse,
  ColumnSummary,
  ColumnClassification,
  ChartConfig,
  GovernanceEvent,
} from '@/lib/types'
import { authHeaders } from '@/lib/auth'

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ?? 'http://localhost:8000'

// Shared API key sent in X-API-Key header.
// The backend ignores this header when API_KEY is not configured (dev mode).
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? ''

const REQUEST_TIMEOUT_MS = 30_000

export class APIError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'APIError'
  }
}

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...extra,
  }
  if (API_KEY) headers['X-API-Key'] = API_KEY
  return headers
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      let detail = res.statusText
      try {
        const json = await res.json()
        detail = json.detail ?? detail
      } catch {
        // ignore parse errors — use statusText
      }
      throw new APIError(res.status, detail)
    }

    return res.json() as Promise<T>
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new APIError(408, 'Request timed out — please try again')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    headers: buildHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const json = await res.json()
      detail = json.detail ?? detail
    } catch {}
    throw new APIError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ─── Existing endpoints ───────────────────────────────────────────

export async function uploadSummary(body: UploadRequest): Promise<UploadResponse> {
  return post<UploadResponse>('/upload', body)
}

export async function generateDashboard(
  body: DashboardRequest,
): Promise<DashboardResponse> {
  return post<DashboardResponse>('/dashboard', body)
}

export async function askQuestion(body: QARequest): Promise<QAResponse> {
  return post<QAResponse>('/qa', body)
}

// ─── Auth endpoints ───────────────────────────────────────────────

export async function deleteSession(): Promise<void> {
  await request<void>('DELETE', '/auth/session')
}

// ─── Saved dashboards ─────────────────────────────────────────────

export interface SavedDashboard {
  id: string
  session_id: string
  filename: string
  column_count: number
  chart_count: number
  label: string | null
  saved_at: string
}

export async function listSavedDashboards(): Promise<{ dashboards: SavedDashboard[] }> {
  return request('GET', '/dashboards')
}

export async function saveDashboard(
  sessionId: string,
  payload: { filename: string; column_count: number; chart_count: number; label?: string },
): Promise<{ saved: boolean; saved_at: string }> {
  return request('POST', `/dashboards/${sessionId}/save`, payload)
}

export async function deleteSavedDashboard(id: string): Promise<void> {
  await request<void>('DELETE', `/dashboards/${id}`)
}

export interface RestoredDashboard {
  filename: string
  column_summary: ColumnSummary[]
  classifications: ColumnClassification[]
  charts: ChartConfig[]
  governance: GovernanceEvent | null
}

export async function restoreDashboard(sessionId: string): Promise<RestoredDashboard> {
  return request<RestoredDashboard>('GET', `/dashboards/${sessionId}/restore`)
}
