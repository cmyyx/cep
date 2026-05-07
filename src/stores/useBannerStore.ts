import { create } from 'zustand'
import { bannerSchedule, characterWeaponMap, standardCharacters } from '@/data/banner-data'
import type {
  BannerSchedule,
  NormalizedWindow,
  CharacterSchedule,
  CharacterScheduleIndex,
  TimelineData,
  TimelineCharRow,
  TimelineBar,
  TimelineMonth,
  StatusBadge,
  StatusBadgeType,
  TimelineTooltip,
} from '@/types/banner'

const DAY_MS = 24 * 60 * 60 * 1000

export type SortMode = 'default' | 'asc' | 'desc'

// --- Normalization ---

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value)
  if (Number.isFinite(parsed)) return parsed
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    const [, y, m, d] = match
    return Date.UTC(Number(y), Number(m) - 1, Number(d), 4, 0, 0)
  }
  return NaN
}

function normalizeSchedule(source: BannerSchedule): CharacterScheduleIndex {
  const result: CharacterScheduleIndex = {}

  for (const [characterName, entry] of Object.entries(source)) {
    if (!entry?.windows?.length) continue

    const windows: NormalizedWindow[] = entry.windows
      .map((w, i) => {
        const startMs = parseTimestamp(w.start)
        const endMs = parseTimestamp(w.end)
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null
        return {
          startMs, endMs,
          startIso: w.start, endIso: w.end,
          version: w.version ?? '',
          sourceIndex: i,
          period: w.period ?? null,
          isRerun: w.isRerun ?? false,
        }
      })
      .filter((w): w is NormalizedWindow => w !== null)
      .sort((a, b) => a.startMs - b.startMs)

    if (!windows.length) continue

    const weaponNames = characterWeaponMap[characterName] ?? []
    const primaryWeaponName = weaponNames[0] ?? ''
    const mainPeriod = windows.find((w) => !w.isRerun && w.period != null)?.period ?? null

    result[characterName] = {
      characterName, windows, weaponNames, primaryWeaponName,
      avatarSrc: `/images/characters/${characterName}.avif`,
      period: mainPeriod, isStandard: false,
    }
  }

  for (const name of standardCharacters) {
    if (result[name]) continue
    result[name] = {
      characterName: name, windows: [],
      weaponNames: characterWeaponMap[name] ?? [],
      primaryWeaponName: (characterWeaponMap[name] ?? [])[0] ?? '',
      avatarSrc: `/images/characters/${name}.avif`,
      period: null, isStandard: true,
    }
  }

  return result
}

// --- Timeline derivation ---

function formatMonthLabel(date: Date, locale?: string): string {
  try { return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short' }).format(date) }
  catch { return `${date.getFullYear()}/${date.getMonth() + 1}` }
}

function formatFullDate(ms: number, locale?: string): string {
  const d = new Date(ms)
  try { return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'numeric', day: 'numeric' }).format(d) }
  catch { return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` }
}

function formatShortDate(ms: number, locale?: string): string {
  const d = new Date(ms)
  try { return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(d) }
  catch { return `${d.getMonth() + 1}/${d.getDate()}` }
}

interface PeriodBound { startMs: number; endMs: number }

interface DeriveTimelineOptions {
  nowMs: number
  pxPerDay: number
  sortMode: SortMode
  locale?: string
  t: (key: string, params?: Record<string, number | string>) => string
}

function deriveTimelineData(
  schedule: CharacterScheduleIndex,
  options: DeriveTimelineOptions,
): TimelineData | null {
  const { nowMs, pxPerDay, sortMode, locale, t } = options

  // 1. Build period boundaries
  const periodBounds = new Map<number, PeriodBound>()
  for (const record of Object.values(schedule)) {
    for (const w of record.windows) {
      if (w.isRerun || w.period == null) continue
      const existing = periodBounds.get(w.period)
      if (!existing) {
        periodBounds.set(w.period, { startMs: w.startMs, endMs: w.endMs })
      } else {
        existing.startMs = Math.min(existing.startMs, w.startMs)
        existing.endMs = Math.max(existing.endMs, w.endMs)
      }
    }
  }
  const sortedPeriods = Array.from(periodBounds.keys()).sort((a, b) => a - b)
  const maxPeriod = sortedPeriods.length > 0 ? sortedPeriods[sortedPeriods.length - 1] : 0

  // Estimate missing future periods
  if (sortedPeriods.length >= 2) {
    for (let p = maxPeriod + 1; p <= maxPeriod + 2; p++) {
      const prevBound = periodBounds.get(p - 1)!
      const estStart = prevBound.endMs
      const estDuration = prevBound.endMs - prevBound.startMs
      periodBounds.set(p, { startMs: estStart, endMs: estStart + estDuration })
    }
  }

  // 2. Find current period
  let currentPeriod = 0
  for (const p of sortedPeriods) {
    const bound = periodBounds.get(p)!
    if (nowMs >= bound.startMs && nowMs <= bound.endMs) currentPeriod = p
    else if (nowMs > bound.endMs) currentPeriod = Math.max(currentPeriod, p)
  }

  // 3. Build character entries (exclude standard from main timeline)
  const limitedChars: {
    name: string; avatarSrc: string
    wins: { startMs: number; endMs: number; version: string; isRerun: boolean }[]
    period: number | null; isStandard: boolean
  }[] = []
  const stdChars: { name: string; avatarSrc: string }[] = []
  let gMin = Infinity
  let gMax = -Infinity

  for (const [name, record] of Object.entries(schedule)) {
    if (record.isStandard) {
      stdChars.push({ name, avatarSrc: record.avatarSrc })
      continue
    }
    const wins = record.windows.map((w) => ({
      startMs: w.startMs, endMs: w.endMs, version: w.version, isRerun: w.isRerun,
    }))
    for (const w of wins) {
      if (w.startMs < gMin) gMin = w.startMs
      if (w.endMs > gMax) gMax = w.endMs
    }
    limitedChars.push({
      name, avatarSrc: record.avatarSrc, wins,
      period: record.period, isStandard: false,
    })
  }

  if (!limitedChars.length) return null

  // Extend gMax for in-pool ranges
  for (const ch of limitedChars) {
    if (ch.period == null) continue
    const p1 = periodBounds.get(ch.period + 1)
    const p2 = periodBounds.get(ch.period + 2)
    if (p1 && p1.startMs < gMin) gMin = p1.startMs
    if (p2 && p2.endMs > gMax) gMax = p2.endMs
  }

  // 4. Status determination
  const getCharStatus = (ch: typeof limitedChars[0]): { badgeType: StatusBadgeType; priority: number } => {
    let hasActiveMain = false, activeMainEnd = 0
    let hasActiveRerun = false, rerunEnd = 0
    let hasUpcomingRerun = false, nextRerunStart = Infinity

    for (const w of ch.wins) {
      const isActive = nowMs >= w.startMs && nowMs <= w.endMs
      if (w.isRerun) {
        if (isActive) { hasActiveRerun = true; rerunEnd = Math.max(rerunEnd, w.endMs) }
        if (!isActive && nowMs < w.startMs) { hasUpcomingRerun = true; nextRerunStart = Math.min(nextRerunStart, w.startMs) }
      } else {
        if (isActive) { hasActiveMain = true; activeMainEnd = Math.max(activeMainEnd, w.endMs) }
      }
    }

    if (hasActiveMain) return { badgeType: 'active', priority: 0 }
    if (hasActiveRerun || hasUpcomingRerun) return { badgeType: 'upcoming', priority: 1 }
    if (ch.period != null && currentPeriod > 0 && currentPeriod - ch.period >= 1 && currentPeriod - ch.period <= 2) {
      return { badgeType: 'inPool', priority: 2 }
    }
    return { badgeType: 'out', priority: 3 }
  }

  // 5. Sort based on mode
  if (sortMode === 'default') {
    limitedChars.sort((a, b) => {
      const sa = getCharStatus(a)
      const sb = getCharStatus(b)
      if (sa.priority !== sb.priority) return sa.priority - sb.priority
      return (a.period ?? 0) - (b.period ?? 0)
    })
  } else if (sortMode === 'asc') {
    limitedChars.sort((a, b) => (a.period ?? 0) - (b.period ?? 0))
  } else {
    limitedChars.sort((a, b) => (b.period ?? 0) - (a.period ?? 0))
  }

  // 6. Timeline range
  const rStart = new Date(gMin)
  rStart.setDate(1); rStart.setHours(0, 0, 0, 0)
  const rEnd = new Date(gMax)
  rEnd.setMonth(rEnd.getMonth() + 2); rEnd.setDate(1); rEnd.setHours(0, 0, 0, 0)
  const rStartMs = rStart.getTime()
  const rEndMs = rEnd.getTime()
  const totalDays = Math.ceil((rEndMs - rStartMs) / DAY_MS)

  const months: TimelineMonth[] = []
  const cur = new Date(rStart)
  while (cur < rEnd) {
    const nxt = new Date(cur); nxt.setMonth(nxt.getMonth() + 1)
    const mEnd = Math.min(nxt.getTime(), rEndMs)
    const days = Math.ceil((mEnd - cur.getTime()) / DAY_MS)
    months.push({ label: formatMonthLabel(cur, locale), wPx: Math.round(days * pxPerDay) })
    cur.setMonth(cur.getMonth() + 1)
  }

  const canvasW = Math.round(totalDays * pxPerDay)
  const showToday = nowMs >= rStartMs && nowMs <= rEndMs
  const todayPx = showToday ? ((nowMs - rStartMs) / DAY_MS) * pxPerDay : null

  // 7. Build rows
  const makeBar = (startMs: number, endMs: number, cls: TimelineBar['cls'], statusText: string, versionLabel: string): TimelineBar => {
    const leftPx = ((startMs - rStartMs) / DAY_MS) * pxPerDay
    const widthPx = Math.max(((endMs - startMs) / DAY_MS) * pxPerDay, 4)
    const fullLabel = `${formatFullDate(startMs, locale)} – ${formatFullDate(endMs, locale)}`
    const shortLabel = `${formatShortDate(startMs, locale)}–${formatShortDate(endMs, locale)}`
    const durationDays = Math.ceil((endMs - startMs) / DAY_MS)
    return {
      leftPx, widthPx, cls,
      dateLabel: widthPx >= 40 ? shortLabel : '',
      fullLabel, charName: '', charLabel: '',
      statusText, durationDays, versionLabel, startMs, endMs,
    }
  }

  const charRows: TimelineCharRow[] = limitedChars.map((ch) => {
    const { badgeType } = getCharStatus(ch)
    const bars: TimelineBar[] = []

    for (const w of ch.wins) {
      const isActive = nowMs >= w.startMs && nowMs <= w.endMs
      const isPast = nowMs > w.endMs
      if (w.isRerun) {
        bars.push(makeBar(w.startMs, w.endMs, 'rerun',
          isActive ? t('bannerCalendar.statusRerunActive') : isPast ? t('bannerCalendar.statusPast') : t('bannerCalendar.statusUpcoming'), w.version))
      } else if (isActive) {
        bars.push(makeBar(w.startMs, w.endMs, 'active', t('bannerCalendar.statusActive'), w.version))
      } else {
        bars.push(makeBar(w.startMs, w.endMs, 'past', t('bannerCalendar.statusPast'), w.version))
      }
    }

    if (ch.period != null && badgeType === 'inPool') {
      const nextP = periodBounds.get(ch.period + 1)
      const afterP = periodBounds.get(ch.period + 2)
      if (nextP) {
        bars.push(makeBar(nextP.startMs, afterP ? afterP.endMs : nextP.endMs, 'inPool', t('bannerCalendar.statusInPool'), ''))
      }
    }

    for (const bar of bars) { bar.charName = ch.name; bar.charLabel = ch.name }
    bars.sort((a, b) => a.startMs - b.startMs)

    let statusBadge: StatusBadge | null = null
    if (badgeType === 'active') {
      const w = ch.wins.find((w) => !w.isRerun && nowMs >= w.startMs && nowMs <= w.endMs)
      if (w) { const d = Math.max(1, Math.ceil((w.endMs - nowMs) / DAY_MS)); statusBadge = { type: 'active', days: d, text: t('bannerCalendar.badgeActive', { days: d }) } }
    } else if (badgeType === 'upcoming') {
      const active = ch.wins.find((w) => w.isRerun && nowMs >= w.startMs && nowMs <= w.endMs)
      const upcoming = ch.wins.find((w) => w.isRerun && nowMs < w.startMs)
      if (active) { const d = Math.max(1, Math.ceil((active.endMs - nowMs) / DAY_MS)); statusBadge = { type: 'upcoming', days: d, text: t('bannerCalendar.badgeUpcoming', { days: d }) } }
      else if (upcoming) { const d = Math.max(1, Math.ceil((upcoming.startMs - nowMs) / DAY_MS)); statusBadge = { type: 'upcoming', days: d, text: t('bannerCalendar.badgeUpcoming', { days: d }) } }
    } else if (badgeType === 'inPool') {
      statusBadge = { type: 'inPool', text: t('bannerCalendar.badgeInPool') }
    } else {
      statusBadge = { type: 'out', text: t('bannerCalendar.badgeOut') }
    }

    return { name: ch.name, avatarSrc: ch.avatarSrc, bars, hasActive: badgeType === 'active', statusBadge }
  })

  return {
    charRows, months, canvasW,
    rStartMs, rEndMs, totalDays, pxPerDay,
    todayPx, showToday, nowMs,
    standardChars: stdChars,
  }
}

// --- Store ---

interface BannerState {
  zoom: number
  fullOverview: boolean
  showPreviewAxis: boolean
  sortMode: SortMode
  tooltip: TimelineTooltip | null
  timelineData: TimelineData | null
  needsFit: boolean

  setZoom: (value: number) => void
  toggleFullOverview: () => void
  togglePreviewAxis: () => void
  setSortMode: (mode: SortMode) => void
  setTooltip: (tip: TimelineTooltip | null) => void
  refresh: (t: (key: string, params?: Record<string, number | string>) => string, locale?: string) => void
  fitToViewport: (t: (key: string, params?: Record<string, number | string>) => string, locale?: string) => void
}

const DEFAULT_ZOOM = 5
const MIN_ZOOM = 1.5
const MAX_ZOOM = 15

const normalizedCache = normalizeSchedule(bannerSchedule)

export const useBannerStore = create<BannerState>((set, get) => ({
  zoom: DEFAULT_ZOOM,
  fullOverview: false,
  showPreviewAxis: true,
  sortMode: 'default',
  tooltip: null,
  timelineData: null,
  needsFit: true,

  setZoom: (value: number) => {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
    set({ zoom: z, fullOverview: false })
  },

  toggleFullOverview: () => {
    const { fullOverview, timelineData } = get()
    if (!timelineData) return
    if (!fullOverview) {
      const rightPanel = document.querySelector<HTMLElement>('[data-timeline-right]')
      const availW = rightPanel?.getBoundingClientRect().width ?? window.innerWidth - 208
      const fitZoom = availW / timelineData.totalDays
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(fitZoom * 10) / 10))
      set({ fullOverview: true, zoom: z })
    } else {
      set({ fullOverview: false, zoom: DEFAULT_ZOOM })
    }
  },

  togglePreviewAxis: () => set((s) => ({ showPreviewAxis: !s.showPreviewAxis })),

  setSortMode: (mode: SortMode) => set({ sortMode: mode }),

  setTooltip: (tip) => set({ tooltip: tip }),

  refresh: (t, locale) => {
    const { zoom, sortMode } = get()
    const nowMs = Date.now()
    const data = deriveTimelineData(normalizedCache, { nowMs, pxPerDay: zoom, sortMode, locale, t })
    set({ timelineData: data })
  },

  fitToViewport: (t, locale) => {
    const { sortMode } = get()
    const nowMs = Date.now()
    const probe = deriveTimelineData(normalizedCache, { nowMs, pxPerDay: 1, sortMode, locale, t })
    if (!probe) return
    const rightPanel = document.querySelector<HTMLElement>('[data-timeline-right]')
    const availW = rightPanel?.getBoundingClientRect().width ?? (typeof window !== 'undefined' ? window.innerWidth - 208 : 800)
    const fitZoom = Math.round((availW / probe.totalDays) * 10) / 10
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom))
    const data = deriveTimelineData(normalizedCache, { nowMs, pxPerDay: z, sortMode, locale, t })
    set({ timelineData: data, zoom: z, fullOverview: true, needsFit: false })
  },
}))
