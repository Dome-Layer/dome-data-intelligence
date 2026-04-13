import type {
  UploadRequest,
  UploadResponse,
  DashboardRequest,
  DashboardResponse,
  QARequest,
  QAResponse,
} from '@/lib/types'

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

// Forward the dome_auth_token SSO cookie as a Bearer token so the backend
// can optionally link sessions to the authenticated DOME Platform user.
// Returns an empty object when no SSO session is active (anonymous usage).
function getAuthHeaders(): Record<string, string> {
  if (typeof document === 'undefined') return {}
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('dome_auth_token='))
  if (!match) return {}
  const token = match.split('=').slice(1).join('=')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    }
    if (API_KEY) headers['X-API-Key'] = API_KEY

    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method: 'POST',
      headers,
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
