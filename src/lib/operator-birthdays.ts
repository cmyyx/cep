import type { CharacterBirthday } from '@/types/wiki'

/** Character ids whose birthday falls on the given date, in data order. */
export function getBirthdayCharacterIds(
  date: Date,
  birthdays: readonly CharacterBirthday[]
): string[] {
  const month = date.getMonth() + 1
  const day = date.getDate()
  return birthdays
    .filter((entry) => entry.month === month && entry.day === day)
    .map((entry) => entry.id)
}

/** Stable dismiss key shared with the holiday banner store: `birthday-{m}-{d}`. */
export function getBirthdayDismissKey(date: Date): string {
  return `birthday-${date.getMonth() + 1}-${date.getDate()}`
}

/** Locale-aware name separator: `、` for zh/ja, `, ` for en. */
export function getBirthdayNameSeparator(locale: string): string {
  return locale === 'en' ? ', ' : '、'
}

/** Join operator names for banner copy, e.g. `安塔尔、余烬`. */
export function joinBirthdayNames(names: readonly string[], locale: string): string {
  return names.join(getBirthdayNameSeparator(locale))
}
