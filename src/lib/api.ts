const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

// ─── Token storage helpers ──────────────────────────────────

function getTokens(): { accessToken: string | null; refreshToken: string | null } {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null }
  try {
    const raw = localStorage.getItem('cep-tokens')
    if (!raw) return { accessToken: null, refreshToken: null }
    const parsed = JSON.parse(raw)
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
    }
  } catch {
    return { accessToken: null, refreshToken: null }
  }
}

function saveTokens(accessToken: string, refreshToken: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('cep-tokens', JSON.stringify({ accessToken, refreshToken }))
  } catch {
    // localStorage may be full or disabled
  }
}

function clearTokens() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem('cep-tokens')
  } catch {
    /* ignore */
  }
}

// ─── Refresh lock (prevents concurrent refresh calls) ─────

let refreshPromise: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  const { refreshToken } = getTokens()
  if (!refreshToken) return false

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        clearTokens()
        // Notify store so UI immediately shows "session expired"
        try {
          const { useAuthStore } = await import('@/stores/useAuthStore')
          useAuthStore.setState({ accessToken: null, refreshToken: null, sessionExpired: true })
        } catch { /* store not available */ }
      }
      return false
    }
    const data = await res.json()
    if (data.accessToken && data.refreshToken) {
      saveTokens(data.accessToken, data.refreshToken)
      // Also update Zustand store — the store reads tokens from localStorage only on rehydration,
      // so without this, the store's accessToken stays stale and the UI shows "session expired" incorrectly.
      try {
        const { useAuthStore } = await import('@/stores/useAuthStore')
        useAuthStore.setState({ accessToken: data.accessToken, refreshToken: data.refreshToken, sessionExpired: false })
      } catch { /* store not available */ }
      return true
    }
    return false
  } catch {
    return false
  }
}

async function refreshTokens(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

// ─── API client ────────────────────────────────────────────

interface ApiOptions {
  method?: string
  body?: unknown
  token?: string | null
  noAuth?: boolean
  headers?: Record<string, string>
}

export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, noAuth, headers: customHeaders } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  }

  const authToken = token ?? (noAuth ? null : getTokens().accessToken)
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  // If 401 and not already retried, attempt refresh then retry once
  if (res.status === 401 && !noAuth && !token) {
    const refreshed = await refreshTokens()
    if (refreshed) {
      const newToken = getTokens().accessToken
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`
      }
      const retryRes = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
      const retryData = await retryRes.json()
      if (!retryRes.ok) {
        throw new ApiError(
          retryData.error ?? 'unknown_error',
          retryRes.status,
          retryData,
        )
      }
      return retryData as T
    }
  }

  const data = await res.json()
  if (!res.ok) {
    throw new ApiError(data.error ?? 'unknown_error', res.status, data)
  }
  return data as T
}

// ─── ApiError ──────────────────────────────────────────────

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

// ─── Auth API ──────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  username: string
}

export interface RegisterResponse {
  accessToken: string
  refreshToken: string
  username: string
  email: string
}

export interface MeResponse {
  id: number
  username: string
  email: string | null
  email_verified: boolean
  email_verification_required: boolean
  plan_tier: 'free' | 'premium'
  plan_expires_at: string | null
  plan_expiring_soon: boolean
  premium_until: string | null
  premium_trial_until: string | null
  payment_claims: unknown[]
  sessions: SessionInfo[]
}

export async function loginApi(
  login: string,
  password: string,
  turnstileToken?: string | null,
  deviceName?: string | null,
) {
  return api<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { login, password, turnstileToken, deviceName },
    noAuth: true,
  })
}

export async function registerApi(
  username: string,
  email: string,
  password: string,
  turnstileToken?: string | null,
  deviceName?: string | null,
) {
  return api<RegisterResponse>('/api/auth/register', {
    method: 'POST',
    body: { username, email, password, turnstileToken, deviceName },
    noAuth: true,
  })
}

export async function getMeApi() {
  return api<MeResponse>('/api/auth/me')
}

export interface SessionInfo {
  id: number
  ip: string | null
  deviceName: string | null
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
  isCurrent: boolean
}

export interface SessionsResponse {
  sessions: SessionInfo[]
}

export async function getSessionsApi() {
  return api<SessionsResponse>('/api/auth/sessions')
}

export async function revokeSessionApi(sessionId: number) {
  return api<{ success: boolean }>(`/api/auth/sessions/${sessionId}`, {
    method: 'DELETE',
  })
}

export async function logoutApi() {
  const { refreshToken } = getTokens()
  if (refreshToken) {
    await api('/api/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    }).catch(() => {
      /* ignore */
    })
  }
  clearTokens()
}

// ─── Sync API ──────────────────────────────────────────────

export interface SyncDataResponse {
  data: unknown
  version: number
  updatedAt: string | null
}

export async function getSyncDataApi() {
  return api<SyncDataResponse>('/api/sync')
}

export async function postSyncDataApi(payload: unknown, syncType: 'auto' | 'manual' = 'manual') {
  return api<{ success: boolean; version: number }>('/api/sync', {
    method: 'POST',
    body: payload,
    headers: { 'X-Sync-Type': syncType },
  })
}

// ─── Token management (exported for store) ─────────────────

export { getTokens, saveTokens, clearTokens }
