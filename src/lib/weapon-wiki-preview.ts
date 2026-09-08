import { plainWikiPreviewText, plainWikiPreviewValue } from '@/components/shared/planner-wiki-preview'
import { weapons } from '@/data/weapons'
import { wikiWeaponPlannerPreviews } from '@/generated/data/wiki/planner-previews'
import { getGameI18nCatalog } from '@/lib/game-i18n-catalogs'
import { wikiTextKey } from '@/lib/wiki-i18n'
import type { WikiLocale } from '@/types/wiki'

const EMPTY_PREVIEW_VALUE = { levelOne: '—', maxLevel: '—' } as const
type TextResolver = (weaponId: string, skillId: string, level: number) => string

export function getWeaponWikiPreview(
  weaponId: string | undefined,
  locale: WikiLocale,
  resolveText?: TextResolver,
) {
  const preview = weaponId ? wikiWeaponPlannerPreviews[weaponId] : undefined
  const weapon = weaponId ? weapons.find((entry) => entry.id === weaponId) : undefined
  const slots = weapon ? [weapon.primaryStat, weapon.elementalDamage, weapon.specialAbility] : [null, null, null]
  const catalog = getGameI18nCatalog(locale, 'wikiData')
  const resolve = (skillId: string, level: number) => resolveText?.(weaponId ?? '', skillId, level)
    ?? catalog[wikiTextKey('weapon', weaponId ?? '', 'skill', skillId, 'level', level)]
    ?? '—'
  let previewIndex = 0

  return {
    levelOneLabel: preview?.stats[0]?.levelOneLabel,
    maxLevelLabel: preview?.stats[0]?.maxLevelLabel,
    values: slots.map((slot, slotIndex) => {
      if (slot === null) return EMPTY_PREVIEW_VALUE
      const range = preview?.stats[previewIndex++]
      if (!range) return EMPTY_PREVIEW_VALUE
      const levelOne = resolve(range.levelOne.skillId, range.levelOne.level)
      const maxLevel = resolve(range.maxLevel.skillId, range.maxLevel.level)
      const format = slotIndex < 2 ? plainWikiPreviewValue : plainWikiPreviewText
      return { levelOne: format(levelOne), maxLevel: format(maxLevel) }
    }),
    wikiHref: weaponId?.startsWith('wpn_') ? `/${locale}/wiki/weapons/${weaponId}` : undefined,
  }
}
