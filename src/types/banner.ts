export interface BannerWindow {
  start: string // ISO 8601 with timezone offset, e.g. "2026-01-22T12:00:00+08:00"
  end: string
  version?: string
  period?: number // 卡池期数 (1-based), only set for main UP windows
  isRerun?: boolean // true = 辉光庆典复刻池
}

export interface BannerSchedule {
  [characterName: string]: {
    windows: BannerWindow[]
    offRateNote?: string
  }
}

/** Normalized window with computed timestamps */
export interface NormalizedWindow {
  startMs: number
  endMs: number
  startIso: string
  endIso: string
  version: string
  sourceIndex: number
  period: number | null
  isRerun: boolean
}

/** Per-character normalized schedule entry */
export interface CharacterSchedule {
  characterName: string
  windows: NormalizedWindow[]
  avatarSrc: string
  period: number | null // main UP period (from non-rerun window)
  isStandard: boolean
  offRateNote?: string
}

/** Per-character normalized schedule index */
export interface CharacterScheduleIndex {
  [characterName: string]: CharacterSchedule
}

/** A positioned bar in the Gantt chart */
export interface TimelineBar {
  leftPx: number
  widthPx: number
  cls: 'active' | 'past' | 'upcoming' | 'rerun' | 'inPool'
  dateLabel: string
  fullLabel: string
  charName: string
  charLabel: string
  statusText: string
  durationDays: number
  versionLabel: string
  startMs: number
  endMs: number
}

/**
 * Status badge for a character row.
 * - active: 当期主UP (绿色)
 * - upcoming: 复刻中/待复刻 (橙色)
 * - inPool: 可歪限定 — 当期歪池可歪到的前1~2期限定 (浅蓝色)
 * - out: 已退池限定 — 距当前超过2期 (深灰)
 * - standard: 常驻角色 — 永久可歪 (白色/浅灰)
 */
export type StatusBadgeType = 'active' | 'upcoming' | 'inPool' | 'out' | 'standard'

export interface StatusBadge {
  type: StatusBadgeType
  days?: number
  text: string
}

/** A character row in the timeline */
export interface TimelineCharRow {
  name: string
  avatarSrc: string
  bars: TimelineBar[]
  hasActive: boolean
  statusBadge: StatusBadge | null
  offRateNote?: string
}

/** A month column header */
export interface TimelineMonth {
  label: string
  wPx: number
}

/** Standard character info for the separate table */
export interface StandardCharInfo {
  name: string
  avatarSrc: string
}

/** Full timeline data structure for the Gantt chart */
export interface TimelineData {
  charRows: TimelineCharRow[]
  months: TimelineMonth[]
  canvasW: number
  rStartMs: number
  rEndMs: number
  totalDays: number
  pxPerDay: number
  todayPx: number | null
  showToday: boolean
  nowMs: number
  standardChars: StandardCharInfo[]
}

/** Tooltip data when hovering a bar */
export interface TimelineTooltip {
  charName: string
  charLabel: string
  fullLabel: string
  statusText: string
  durationDays: string
  versionLabel: string
  x: number
  y: number
}
