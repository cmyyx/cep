import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Treat "disabled" sentinel as unset for optional URL env vars. Used by features.ts and dev-api.ts. */
export function resolveOptionalUrl(val: string | undefined): string | undefined {
  if (!val || val === 'disabled') return undefined
  return val
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
