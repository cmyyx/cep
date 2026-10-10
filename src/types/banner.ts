export interface BannerWindow {
  start: string // ISO 8601 with timezone offset, e.g. "2026-01-22T12:00:00+08:00"
  end: string
  version?: string
  period?: number // 卡池期数 (1-based), only set for main UP windows
  isRerun?: boolean // true = 非主 UP 窗口（复刻或特殊寻访）
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
  cls: 'active' | 'past' | 'upcoming' | 'rerun' | 'rerunActive' | 'inPool'
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
 * - rerunActive: 复刻进行中 (绿色)
 * - upcoming: 待复刻 (橙色)
 * - inPool: 可歪限定 — 当期歪池可歪到的前1~2期限定 (浅蓝色)
 * - out: 已退池限定 — 距当前超过2期 (深灰)
 * - standard: 常驻角色 — 永久可歪 (白色/浅灰)
 */
export type StatusBadgeType = 'active' | 'rerunActive' | 'upcoming' | 'inPool' | 'notYetAppeared' | 'out' | 'standard'

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
  shortLabel: string
  wPx: number
}

/** Standard character info for the separate table */
export interface StandardCharInfo {
  name: string
  avatarSrc: string
}

/**
 * Days elapsed since the character's latest banner appearance ended
 * (首次 / 复刻 / 特殊寻访 all count uniformly).
 * Only produced for characters that cannot be obtained right now:
 * on-banner and off-rate-pool characters are excluded; a scheduled
 * (upcoming) rerun neither hides the character nor resets the counter
 * until it actually ends.
 */
export interface RerunWaitStat {
  name: string
  days: number
  /** Formatted end date of the window the counter is measured from. */
  lastEndLabel: string
  /** Version label of that window; empty string when the schedule has none. */
  lastVersion: string
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
  /** Out-of-pool characters ranked by days since their last banner ended (ascending). */
  rerunWaitStats: RerunWaitStat[]
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

