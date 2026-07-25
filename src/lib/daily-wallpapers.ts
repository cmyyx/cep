import { z } from 'zod'
import type { DailyWallpaperFeed, DailyWallpaperItem } from '@/types/daily-wallpaper'

const dateSchema = z.string().refine((value) => parseCalendarDate(value) !== null)
const itemSchema = z.object({
  contentDate: dateSchema,
  isToday: z.boolean(),
  imageUrl: z.string().min(1).nullable(),
  actionUrl: z.string().min(1).nullable(),
})
const feedSchema = z.object({
  serverDate: dateSchema,
  current: itemSchema.nullable(),
  history: z.array(itemSchema).max(14),
})

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
  const parsed = feedSchema.safeParse(payload)
  if (!parsed.success) throw new DailyWallpaperError('invalidResponse')
  try {
    return {
      serverDate: parsed.data.serverDate,
      current: parsed.data.current ? resolveItemURLs(parsed.data.current, normalizedEndpoint) : null,
      history: parsed.data.history.map((item) => resolveItemURLs(item, normalizedEndpoint)),
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
