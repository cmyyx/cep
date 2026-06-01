export interface HolidayConfig {
  id: string
  month: number
  day: number
  accentColor: string
  accentColorDark: string
  i18nKey: string
  icon: 'party-popper' | 'gift' | 'cake' | 'star'
  launchYear?: number
}

export type HolidayPhase = 'countdown' | 'active'

export interface ActiveHoliday {
  config: HolidayConfig
  phase: HolidayPhase
  yearNumber?: number
}

export const HOLIDAYS: HolidayConfig[] = [
  {
    id: 'new-year',
    month: 1,
    day: 1,
    accentColor: '#ffd700',
    accentColorDark: '#ffd700',
    i18nKey: 'holiday.newYear',
    icon: 'party-popper',
  },
  {
    id: 'game-anniversary',
    month: 1,
    day: 22,
    accentColor: '#ff7100',
    accentColorDark: '#ff8c33',
    i18nKey: 'holiday.gameAnniversary',
    icon: 'cake',
    launchYear: 2026,
  },
  {
    id: 'tool-anniversary',
    month: 1,
    day: 29,
    accentColor: '#0a72ef',
    accentColorDark: '#3b82f6',
    i18nKey: 'holiday.toolAnniversary',
    icon: 'gift',
    launchYear: 2026,
  },
  {
    id: 'childrens-day',
    month: 6,
    day: 1,
    accentColor: '#f472b6',
    accentColorDark: '#f9a8d4',
    i18nKey: 'holiday.childrensDay',
    icon: 'star',
  },
]

const NEW_YEAR_ID = 'new-year'

const CHINESE_NUMS = [
  '', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '二十一', '二十二', '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九', '三十',
]

export function getChineseYearNumber(n: number): string {
  if (n >= 1 && n <= 30) return CHINESE_NUMS[n]
  return String(n)
}

export function getEnglishOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0]!)
}

export function getYearNumber(launchYear: number, currentYear: number): number {
  return currentYear - launchYear + 1
}

export function getActiveHoliday(date: Date = new Date()): ActiveHoliday | null {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()

  for (const holiday of HOLIDAYS) {
    if (holiday.id === NEW_YEAR_ID) {
      // New Year special: 12/31 23:00+ = countdown, 1/1 = active
      if (month === 12 && day === 31 && hour >= 23) {
        return { config: holiday, phase: 'countdown' }
      }
      if (month === 1 && day === 1) {
        return { config: holiday, phase: 'active' }
      }
      continue
    }

    if (month === holiday.month && day === holiday.day) {
      const yearNumber = holiday.launchYear
        ? getYearNumber(holiday.launchYear, date.getFullYear())
        : undefined
      return { config: holiday, phase: 'active', yearNumber }
    }
  }

  return null
}
