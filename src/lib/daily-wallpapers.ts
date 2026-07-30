import type { WeeklyWallpaperFeed, WeeklyWallpaperItem } from '@/types/daily-wallpaper'

const MAX_HISTORY_ITEMS = 14

function isCalendarDateString(value: unknown): value is string {
  return typeof value === 'string' && parseCalendarDate(value) !== null
}

function isNullableNonEmptyString(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length > 0)
}

function parseWallpaperItem(value: unknown): WeeklyWallpaperItem | null {
  if (typeof value !== 'object' || value === null) return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || item.id === '') return null
  if (!isNullableNonEmptyString(item.imageUrl)) return null
  return {
    id: item.id,
    imageUrl: item.imageUrl,
  }
}

function parseWeeklyWallpaperFeed(value: unknown): WeeklyWallpaperFeed | null {
  if (typeof value !== 'object' || value === null) return null
  const feed = value as Record<string, unknown>
  if (!isCalendarDateString(feed.serverDate)) return null
  if (!isCalendarDateString(feed.weekStart)) return null
  if (!isCalendarDateString(feed.displayUntil)) return null
  if (typeof feed.isActive !== 'boolean') return null

  if (!Array.isArray(feed.weekItems)) return null
  const weekItems: WeeklyWallpaperItem[] = []
  for (const entry of feed.weekItems) {
    const item = parseWallpaperItem(entry)
    if (!item) return null
    weekItems.push(item)
  }

  if (!Array.isArray(feed.history) || feed.history.length > MAX_HISTORY_ITEMS) return null
  const history: WeeklyWallpaperItem[] = []
  for (const entry of feed.history) {
    const item = parseWallpaperItem(entry)
    if (!item) return null
    history.push(item)
  }

  const actionUrl = feed.actionUrl === null || typeof feed.actionUrl === 'string' ? feed.actionUrl : null

  return {
    serverDate: feed.serverDate,
    weekStart: feed.weekStart,
    displayUntil: feed.displayUntil,
    isActive: feed.isActive,
    weekItems,
    actionUrl: actionUrl as string | null,
    history,
  }
}

export class WeeklyWallpaperError extends Error {
  constructor(public readonly code: 'notConfigured' | 'requestFailed' | 'invalidResponse') {
    super(code)
  }
}

export async function fetchWeeklyWallpapers(endpoint: string, signal?: AbortSignal): Promise<WeeklyWallpaperFeed> {
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
    throw new WeeklyWallpaperError('requestFailed')
  }
  if (!response.ok) throw new WeeklyWallpaperError('requestFailed')

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new WeeklyWallpaperError('invalidResponse')
  }
  const parsed = parseWeeklyWallpaperFeed(payload)
  if (!parsed) throw new WeeklyWallpaperError('invalidResponse')
  try {
    return {
      serverDate: parsed.serverDate,
      weekStart: parsed.weekStart,
      displayUntil: parsed.displayUntil,
      isActive: parsed.isActive,
      weekItems: parsed.weekItems.map((item) => resolveItemURLs(item, normalizedEndpoint)),
      actionUrl: parsed.actionUrl,
      history: parsed.history.map((item) => resolveItemURLs(item, normalizedEndpoint)),
    }
  } catch {
    throw new WeeklyWallpaperError('invalidResponse')
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

export function formatWallpaperDateRange(start: string, end: string, locale: string): string {
	const startDate = parseCalendarDate(start)
	const endDate = parseCalendarDate(end)
	if (!startDate || !endDate) return start
	const startFmt = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(startDate)
	const endFmt = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(endDate)
	return `${startFmt}  –  ${endFmt}`
}

export function addWallpaperLocale(actionUrl: string, locale: string): string {
  const url = new URL(actionUrl)
  url.searchParams.set('locale', locale)
  return url.toString()
}

export const DEFAULT_WALLPAPER_ASPECT_RATIO = 16 / 9
export const MIN_WALLPAPER_ASPECT_RATIO = 3 / 4
export const MAX_WALLPAPER_ASPECT_RATIO = 21 / 9

export function resolveWallpaperAspectRatio(width: number, height: number): number {
  if (!(width > 0 && height > 0)) return DEFAULT_WALLPAPER_ASPECT_RATIO
  const ratio = width / height
  return Math.min(MAX_WALLPAPER_ASPECT_RATIO, Math.max(MIN_WALLPAPER_ASPECT_RATIO, ratio))
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim()
  if (!trimmed) throw new WeeklyWallpaperError('notConfigured')
  try {
    return new URL(trimmed).toString()
  } catch {
    throw new WeeklyWallpaperError('notConfigured')
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

function resolveItemURLs(item: WeeklyWallpaperItem, endpoint: string): WeeklyWallpaperItem {
  return {
    ...item,
    imageUrl: item.imageUrl ? new URL(item.imageUrl, endpoint).toString() : null,
  }
}
