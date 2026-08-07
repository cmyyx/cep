import type { WikiLocale } from '@/types/wiki'

/** Structured birthday: month 1-12, day 1-31 (no year). */
export interface BirthdayDate {
  month: number
  day: number
}

/**
 * Localized birthday display, e.g. `4月10日` (zh/ja) or `April 10` (en).
 * The year is pinned to 2000 so only month/day are formatted.
 */
export function formatBirthday(birthday: BirthdayDate, locale: WikiLocale): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
  }).format(new Date(2000, birthday.month - 1, birthday.day))
}
