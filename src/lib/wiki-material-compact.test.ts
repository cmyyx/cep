import { expect, it } from 'vitest'
import { compactWikiMaterials, expandWikiMaterials } from './wiki-material-compact'

it('dedupes repeated materials into refs + catalog', () => {
  const detail = {
    skills: [
      {
        levels: [
          {
            materials: [
              {
                itemId: 'item_a',
                name: { 'zh-CN': '材料A', en: 'Mat A', ja: 'A', 'zh-TW': '材料A' },
                iconId: 'icon_a',
                rarity: 4,
                count: 2,
              },
              {
                itemId: 'item_b',
                name: { 'zh-CN': '材料B', en: 'Mat B', ja: 'B', 'zh-TW': '材料B' },
                iconId: 'icon_b',
                rarity: 3,
                count: 1,
              },
            ],
          },
          {
            materials: [
              {
                itemId: 'item_a',
                name: { 'zh-CN': '材料A', en: 'Mat A', ja: 'A', 'zh-TW': '材料A' },
                iconId: 'icon_a',
                rarity: 4,
                count: 6,
              },
            ],
          },
        ],
      },
    ],
  }

  const { value, catalog } = compactWikiMaterials(detail, 'zh-CN')
  expect(catalog).toEqual({
    item_a: { name: '材料A', iconId: 'icon_a', rarity: 4 },
    item_b: { name: '材料B', iconId: 'icon_b', rarity: 3 },
  })
  expect(value.skills[0].levels[0].materials).toEqual([
    { itemId: 'item_a', count: 2 },
    { itemId: 'item_b', count: 1 },
  ])
  expect(value.skills[0].levels[1].materials).toEqual([{ itemId: 'item_a', count: 6 }])

  const expanded = expandWikiMaterials(value.skills[0].levels[0].materials, catalog)
  expect(expanded[0]).toEqual({
    itemId: 'item_a',
    name: '材料A',
    iconId: 'icon_a',
    rarity: 4,
    count: 2,
  })
})

it('keeps non-material arrays untouched', () => {
  const detail = { levels: [{ level: 1, stats: [{ attributeId: '39', value: 1 }] }] }
  const { value, catalog } = compactWikiMaterials(detail)
  expect(value).toEqual(detail)
  expect(catalog).toEqual({})
})
