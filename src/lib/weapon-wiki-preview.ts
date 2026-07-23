import { plainWikiPreviewText, plainWikiPreviewValue } from '@/components/shared/planner-wiki-preview'
import { weapons } from '@/data/weapons'
import { wikiWeaponPlannerPreviews } from '@/generated/data/wiki/planner-previews'
import type { WikiLocale } from '@/types/wiki'

const EMPTY_PREVIEW_VALUE = { levelOne: '—', maxLevel: '—' } as const

export function getWeaponWikiPreview(weaponId: string | undefined, locale: WikiLocale) {
  const preview = weaponId ? wikiWeaponPlannerPreviews[weaponId] : undefined

  const weapon = weaponId ? weapons.find((entry) => entry.id === weaponId) : undefined
  const slots = weapon
    ? [weapon.primaryStat, weapon.elementalDamage, weapon.specialAbility]
    : [null, null, null]
  let previewIndex = 0

  return {
    levelOneLabel: preview?.stats[0]?.levelOneLabel,
    maxLevelLabel: preview?.stats[0]?.maxLevelLabel,
    values: slots.map((slot, slotIndex) => {
      if (slot === null) return EMPTY_PREVIEW_VALUE
      const range = preview?.stats[previewIndex++]
      if (!range) return EMPTY_PREVIEW_VALUE
      const levelOne = range.levelOne[locale] || range.levelOne['zh-CN']
      const maxLevel = range.maxLevel[locale] || range.maxLevel['zh-CN']
      const format = slotIndex < 2 ? plainWikiPreviewValue : plainWikiPreviewText
      return { levelOne: format(levelOne), maxLevel: format(maxLevel) }
    }),
    wikiHref: weaponId?.startsWith('wpn_') ? `/${locale}/wiki/weapons/${weaponId}` : undefined,
  }
}
