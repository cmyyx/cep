import { expect, it } from 'vitest'
import { matchesWeaponQuery, weaponSearchHaystack, WEAPON_TYPE_LABEL_KEYS, weaponTypeLabel } from './weapon-grid'

const weapon = { name: '雪与霜的赠礼', type: '单手剑' }

const labels: Record<string, string> = {
  'essence.weaponTypes.sword': 'Sword',
}
const translate = (key: string) => labels[key] ?? key

it('maps zh-CN weapon types to localized labels and keeps unknown types verbatim', () => {
  expect(weaponTypeLabel('单手剑', translate)).toBe('Sword')
  expect(weaponTypeLabel('未知类型', translate)).toBe('未知类型')
  expect(Object.keys(WEAPON_TYPE_LABEL_KEYS)).toHaveLength(5)
})

it('searches the localized weapon name and type, not only the zh-CN source data', () => {
  const haystack = weaponSearchHaystack(weapon, 'Gift of Snow and Frost', 'Sword')

  expect(matchesWeaponQuery(haystack, 'snow')).toBe(true)
  expect(matchesWeaponQuery(haystack, 'SWORD')).toBe(true)
  expect(matchesWeaponQuery(haystack, '雪与霜')).toBe(true)
  expect(matchesWeaponQuery(haystack, '单手剑')).toBe(true)
  expect(matchesWeaponQuery(haystack, 'greatsword')).toBe(false)
})

it('treats a blank query as no filter and ignores empty haystack entries', () => {
  expect(matchesWeaponQuery(weaponSearchHaystack(weapon, '', ''), '   ')).toBe(true)
  expect(weaponSearchHaystack(weapon, '', '')).toEqual(['雪与霜的赠礼', '单手剑'])
})
