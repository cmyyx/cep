import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

/** Treat "disabled" sentinel as unset for optional URL env vars. Used by features.ts and dev-api.ts. */
export function resolveOptionalUrl(val: string | undefined): string | undefined {
  if (!val) return undefined
  const normalized = val.trim()
  if (normalized === '' || normalized.toLowerCase() === 'disabled') return undefined
  return normalized
}

/** Mask email for privacy: u***@example.com */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—'
  const at = email.indexOf('@')
  if (at <= 1) return email
  return email[0] + '***' + email.slice(at)
}

/** Simple email format check */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Trigger a browser download of JSON content without direct DOM manipulation in components. */
export function downloadJson(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Strip quantity suffix from material names.
 * "协议圆盘 x20" → "协议圆盘"
 * "折金票 x1.6k" → "折金票"
 */
export function stripMaterialQuantity(name: string): string {
  return name
    .replace(/\s*x\d+$/i, '')
    .replace(/\s*x[\d.]+[kK]?$/i, '')
    .trim()
}
