import { expect, it } from 'vitest'
import { isLocalizedText, localizeText, toLocaleDetail } from './wiki-locale-detail'

it('detects LocalizedText maps and rejects mixed objects', () => {
  expect(isLocalizedText({ 'zh-CN': '甲', en: 'A', ja: 'ア', 'zh-TW': '甲' })).toBe(true)
  expect(isLocalizedText({ 'zh-CN': '甲', en: 'A' })).toBe(true)
  expect(isLocalizedText({ id: 'x', 'zh-CN': '甲' })).toBe(false)
  expect(isLocalizedText({ 'zh-CN': 1 })).toBe(false)
  expect(isLocalizedText(null)).toBe(false)
})

it('localizeText prefers the active locale with zh-CN fallback', () => {
  const text = { 'zh-CN': '中文', en: 'English', ja: '日本語', 'zh-TW': '繁中' } as const
  expect(localizeText(text, 'en')).toBe('English')
  expect(localizeText(text, 'ja')).toBe('日本語')
  expect(localizeText(text, 'fr')).toBe('中文')
  expect(localizeText('already', 'en')).toBe('already')
  expect(localizeText(undefined, 'en')).toBe('')
})

it('toLocaleDetail collapses nested LocalizedText and leaves structure intact', () => {
  const detail = {
    id: 'chr_test',
    skills: [
      {
        name: { 'zh-CN': '技能', en: 'Skill', ja: 'スキル', 'zh-TW': '技能' },
        levels: [
          {
            level: 1,
            materials: [
              {
                itemId: 'item_a',
                name: { 'zh-CN': '材料', en: 'Mat', ja: '素材', 'zh-TW': '材料' },
                iconId: 'item_a',
                rarity: 4,
                count: 3,
              },
            ],
          },
        ],
      },
    ],
    fixedStats: [{ attributeId: '39', value: 1 }],
  }

  const zh = toLocaleDetail(detail, 'zh-CN')
  expect(zh.skills[0].name).toBe('技能')
  expect(zh.skills[0].levels[0].materials[0].name).toBe('材料')
  expect(zh.skills[0].levels[0].materials[0].count).toBe(3)
  expect(zh.fixedStats[0]).toEqual({ attributeId: '39', value: 1 })

  const en = toLocaleDetail(detail, 'en')
  expect(en.skills[0].name).toBe('Skill')
  expect(en.skills[0].levels[0].materials[0].name).toBe('Mat')

  // Source must not be mutated
  expect(detail.skills[0].name).toEqual({ 'zh-CN': '技能', en: 'Skill', ja: 'スキル', 'zh-TW': '技能' })
})
