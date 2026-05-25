/**
 * Dev-only runtime overrides for API configuration.
 *
 * When NEXT_PUBLIC_API_BASE_URL or NEXT_PUBLIC_TURNSTILE_SITE_KEY are not set
 * at build time, developers can override them at runtime via localStorage
 * for local testing without rebuilding.
 *
 * Accessible via 5-click gesture on the Cloud icon in LoginUnavailableGuide.
 */

import { resolveOptionalUrl } from '@/lib/utils'

const DEV_API_URL_KEY = '__cep_dev_api_url'
const DEV_TURNSTILE_KEY = '__cep_dev_turnstile_key'

function getEnvApiBaseUrl(): string {
  return resolveOptionalUrl(process.env.NEXT_PUBLIC_API_BASE_URL) ?? ''
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return getEnvApiBaseUrl()
  }
  try {
    const localVal = localStorage.getItem(DEV_API_URL_KEY)
    if (localVal !== null) {
      return resolveOptionalUrl(localVal) ?? ''
    }
    return getEnvApiBaseUrl()
  } catch {
    return getEnvApiBaseUrl()
  }
}

export function getTurnstileSiteKey(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
  }
  try {
    return localStorage.getItem(DEV_TURNSTILE_KEY) ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
  } catch {
    return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
  }
}

export function isAuthAvailable(): boolean {
  return !!getApiBaseUrl()
}

export function setDevOverrides(apiUrl: string, turnstileKey: string) {
  if (typeof window === 'undefined') return
  try {
    const trimmedApiUrl = apiUrl.trim()
    if (trimmedApiUrl) {
      localStorage.setItem(DEV_API_URL_KEY, trimmedApiUrl)
    } else {
      localStorage.removeItem(DEV_API_URL_KEY)
    }
    const trimmedTurnstileKey = turnstileKey.trim()
    if (trimmedTurnstileKey) {
      localStorage.setItem(DEV_TURNSTILE_KEY, trimmedTurnstileKey)
    } else {
      localStorage.removeItem(DEV_TURNSTILE_KEY)
    }
  } catch { /* ignore */ }
}

export function clearDevOverrides() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(DEV_API_URL_KEY)
    localStorage.removeItem(DEV_TURNSTILE_KEY)
  } catch { /* ignore */ }
}

export function getDevOverrides(): { apiUrl: string; turnstileKey: string } {
  if (typeof window === 'undefined') return { apiUrl: '', turnstileKey: '' }
  try {
    return {
      apiUrl: localStorage.getItem(DEV_API_URL_KEY) ?? '',
      turnstileKey: localStorage.getItem(DEV_TURNSTILE_KEY) ?? '',
    }
  } catch {
    return { apiUrl: '', turnstileKey: '' }
  }
}
