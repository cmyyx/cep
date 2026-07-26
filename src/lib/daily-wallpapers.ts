import type { DailyWallpaperFeed, DailyWallpaperItem } from '@/types/daily-wallpaper'

const MAX_HISTORY_ITEMS = 14

function isCalendarDateString(value: unknown): value is string {
  return typeof value === 'string' && parseCalendarDate(value) !== null
}

function isNullableNonEmptyString(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length > 0)
}

/** Field-by-field validation of one feed item; strips unknown fields. */
function parseWallpaperItem(value: unknown): DailyWallpaperItem | null {
  if (typeof value !== 'object' || value === null) return null
  const item = value as Record<string, unknown>
  if (!isCalendarDateString(item.contentDate)) return null
  if (typeof item.isToday !== 'boolean') return null
  if (!isNullableNonEmptyString(item.imageUrl)) return null
  if (!isNullableNonEmptyString(item.actionUrl)) return null
  return {
    contentDate: item.contentDate,
    isToday: item.isToday,
    imageUrl: item.imageUrl,
    actionUrl: item.actionUrl,
  }
}

/** Hand-written replacement for the previous zod schema (keeps zod out of this route's chunk). */
function parseWallpaperFeed(value: unknown): DailyWallpaperFeed | null {
  if (typeof value !== 'object' || value === null) return null
  const feed = value as Record<string, unknown>
  if (!isCalendarDateString(feed.serverDate)) return null
  const current = feed.current === null ? null : parseWallpaperItem(feed.current)
  if (feed.current !== null && current === null) return null
  if (!Array.isArray(feed.history) || feed.history.length > MAX_HISTORY_ITEMS) return null
  const history: DailyWallpaperItem[] = []
  for (const entry of feed.history) {
    const item = parseWallpaperItem(entry)
    if (!item) return null
    history.push(item)
  }
  return { serverDate: feed.serverDate, current, history }
}

export class DailyWallpaperError extends Error {
  constructor(public readonly code: 'notConfigured' | 'requestFailed' | 'invalidResponse') {
    super(code)
  }
}

export async function fetchDailyWallpapers(endpoint: string, signal?: AbortSignal): Promise<DailyWallpaperFeed> {
  const normalizedEndpoint = normalizeEndpoint(endpoint)
  let response: Response
  try {
    response = await fetch(normalizedEndpoint, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new DailyWallpaperError('requestFailed')
  }
  if (!response.ok) throw new DailyWallpaperError('requestFailed')

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new DailyWallpaperError('invalidResponse')
  }
  const parsed = parseWallpaperFeed(payload)
  if (!parsed) throw new DailyWallpaperError('invalidResponse')
  try {
    return {
      serverDate: parsed.serverDate,
      current: parsed.current ? resolveItemURLs(parsed.current, normalizedEndpoint) : null,
      history: parsed.history.map((item) => resolveItemURLs(item, normalizedEndpoint)),
    }
  } catch {
    throw new DailyWallpaperError('invalidResponse')
  }
}

export function formatWallpaperDate(value: string, locale: string): string {
  const date = parseCalendarDate(value)
  if (!date) return value
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function addWallpaperLocale(actionUrl: string, locale: string): string {
  const url = new URL(actionUrl)
  url.searchParams.set('locale', locale)
  return url.toString()
}

/** Default frame before natural dimensions are known. */
export const DEFAULT_WALLPAPER_ASPECT_RATIO = 16 / 9

/** Clamp tall wallpapers so the frame does not try to grow endlessly. */
export const MIN_WALLPAPER_ASPECT_RATIO = 3 / 4

/** Clamp ultra-wide wallpapers so the frame does not collapse too flat. */
export const MAX_WALLPAPER_ASPECT_RATIO = 21 / 9

export function resolveWallpaperAspectRatio(width: number, height: number): number {
  if (!(width > 0 && height > 0)) return DEFAULT_WALLPAPER_ASPECT_RATIO
  const ratio = width / height
  return Math.min(MAX_WALLPAPER_ASPECT_RATIO, Math.max(MIN_WALLPAPER_ASPECT_RATIO, ratio))
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim()
  if (!trimmed) throw new DailyWallpaperError('notConfigured')
  try {
    return new URL(trimmed).toString()
  } catch {
    throw new DailyWallpaperError('notConfigured')
  }
}

function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

function resolveItemURLs(item: DailyWallpaperItem, endpoint: string): DailyWallpaperItem {
  return {
    ...item,
    imageUrl: item.imageUrl ? new URL(item.imageUrl, endpoint).toString() : null,
    actionUrl: item.actionUrl ? new URL(item.actionUrl, endpoint).toString() : null,
  }
}
