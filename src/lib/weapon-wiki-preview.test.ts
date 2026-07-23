import { expect, it } from 'vitest'
import { wikiWeaponPlannerPreviews } from '@/generated/data/wiki/planner-previews'
import { getWeaponWikiPreview } from './weapon-wiki-preview'

it('formats numeric and descriptive weapon preview values with locale fallback', () => {
  const [weaponId, preview] = Object.entries(wikiWeaponPlannerPreviews).find(([, value]) => value.stats.length >= 3)!
  const result = getWeaponWikiPreview(weaponId, 'en')

  expect(result.values[0].levelOne).toMatch(/[+-]?\d/)
  expect(result.values[2].levelOne).not.toContain('<')
  expect(result.levelOneLabel).toBe(preview.stats[0].levelOneLabel)
  expect(result.wikiHref).toBe(`/en/wiki/weapons/${weaponId}`)
})

it('aligns compact three-star previews with their non-empty semantic slots', () => {
  const result = getWeaponWikiPreview('wpn_claym_0010', 'zh-CN')

  expect(result.values[0]).toEqual({ levelOne: '+10', maxLevel: '+79' })
  expect(result.values[1]).toEqual({ levelOne: '—', maxLevel: '—' })
  expect(result.values[2].levelOne).toContain('+12')
  expect(result.values[2].maxLevel).toContain('+34')
})

it('returns placeholders and no link for non-Wiki weapon IDs', () => {
  expect(getWeaponWikiPreview('custom-test', 'zh-CN')).toEqual({
    levelOneLabel: undefined,
    maxLevelLabel: undefined,
    values: [
      { levelOne: '—', maxLevel: '—' },
      { levelOne: '—', maxLevel: '—' },
      { levelOne: '—', maxLevel: '—' },
    ],
    wikiHref: undefined,
  })
})

it('returns placeholders and no link when the weapon ID is missing', () => {
  expect(getWeaponWikiPreview(undefined, 'zh-CN')).toEqual({
    levelOneLabel: undefined,
    maxLevelLabel: undefined,
    values: [
      { levelOne: '—', maxLevel: '—' },
      { levelOne: '—', maxLevel: '—' },
      { levelOne: '—', maxLevel: '—' },
    ],
    wikiHref: undefined,
  })
})
