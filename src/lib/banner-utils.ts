import { bannerSchedule } from '@/data/banner-data'
import type { Weapon } from '@/types/matrix'

/**
 * Check if a character is currently on banner (within any UP window).
 */
export function isCharacterOnBanner(characterName: string): boolean {
  const entry = bannerSchedule[characterName]
  if (!entry?.windows?.length) return false

  const now = Date.now()
  return entry.windows.some((w) => {
    const start = Date.parse(w.start)
    const end = Date.parse(w.end)
    return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end
  })
}

/**
 * Check if any of the weapon's characters are currently on banner.
 */
export function isWeaponOnBanner(weapon: Weapon): boolean {
  if (!weapon.chars?.length) return false
  return weapon.chars.some(isCharacterOnBanner)
}
