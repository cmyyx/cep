import { plainWikiPreviewText, plainWikiPreviewValue } from '@/components/shared/planner-wiki-preview'
import { wikiWeaponPlannerPreviews } from '@/generated/data/wiki/planner-previews'
import type { WikiLocale } from '@/types/wiki'

const EMPTY_PREVIEW_VALUE = { levelOne: '—', maxLevel: '—' } as const

export function getWeaponWikiPreview(weaponId: string, locale: WikiLocale) {
  const preview = wikiWeaponPlannerPreviews[weaponId]

  return {
    levelOneLabel: preview?.stats[0]?.levelOneLabel,
    maxLevelLabel: preview?.stats[0]?.maxLevelLabel,
    values: [0, 1, 2].map((index) => {
      const range = preview?.stats[index]
      if (!range) return EMPTY_PREVIEW_VALUE
      const levelOne = range.levelOne[locale] || range.levelOne['zh-CN']
      const maxLevel = range.maxLevel[locale] || range.maxLevel['zh-CN']
      const format = index < 2 ? plainWikiPreviewValue : plainWikiPreviewText
      return { levelOne: format(levelOne), maxLevel: format(maxLevel) }
    }),
    wikiHref: weaponId.startsWith('wpn_') ? `/${locale}/wiki/weapons/${weaponId}` : undefined,
  }
}
