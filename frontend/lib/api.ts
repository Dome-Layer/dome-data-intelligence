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

export class APIError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'APIError'
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
