const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''

interface ApiOptions {
  method?: string
  body?: unknown
  token?: string | null
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  const data = await res.json()

  if (!res.ok) {
    throw new ApiError(data.error || 'unknown_error', res.status, data)
  }

  return data as T
}

export class ApiError extends Error {
  code: string
  status: number
  data: unknown

  constructor(code: string, status: number, data?: unknown) {
    super(code)
    this.code = code
    this.status = status
    this.data = data
  }
}

// Auth API
export interface LoginResponse {
  success: boolean
  token: string
  username: string
}

export interface MeResponse {
  id: number
  username: string
  email: string
  plan_tier: string
}

export function loginApi(login: string, password: string) {
  return api<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { login, password },
  })
}

export function getMeApi(token: string) {
  return api<MeResponse>('/api/auth/me', { token })
}

export function logoutApi(token: string) {
  return api('/api/auth/logout', { method: 'POST', token })
}
