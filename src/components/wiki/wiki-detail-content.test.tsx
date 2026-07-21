import { expect, it } from 'vitest'
import {
  getAdjacentSpans,
  easeWikiScroll,
  getEquipmentStatValues,
  getSkillDisplayVariants,
  getVisibleCharacterLevels,
  getVisibleSkillLevels,
  getVisibleWeaponLevels,
  getVoiceActorDisplayName,
  getWidestTableValue,
  WikiDetailHero,
} from './wiki-detail-content'
import type {
  WikiCharacterLevel,
  WikiCharacterSkill,
  WikiCharacterSkillLevel,
  WikiCharacterVoiceName,
  WikiEquipmentStat,
  WikiSkillLevel,
  WikiWeaponLevel,
} from '@/types/wiki'
import { renderToStaticMarkup } from 'react-dom/server'

const levels: WikiCharacterLevel[] = [
  { level: 1, breakStage: 0, isBreakthrough: false, stats: [] },
  { level: 20, breakStage: 1, isBreakthrough: true, stats: [] },
  { level: 90, breakStage: 3, isBreakthrough: false, stats: [] },
]

it('shows only level 90 by default and every level when expanded', () => {
  expect(getVisibleCharacterLevels(levels, false).map((level) => level.level)).toEqual([90])
  expect(getVisibleCharacterLevels(levels, true)).toEqual(levels)
})

const weaponLevels: WikiWeaponLevel[] = [
  { level: 1, baseAttack: 50 },
  { level: 45, baseAttack: 300 },
  { level: 90, baseAttack: 600 },
]

it('shows only level 90 weapon data by default and every level when expanded', () => {
  expect(getVisibleWeaponLevels(weaponLevels, false)).toEqual([{ level: 90, baseAttack: 600 }])
  expect(getVisibleWeaponLevels(weaponLevels, true)).toEqual(weaponLevels)
})

const skillLevels: WikiCharacterSkillLevel[] = [
  { level: 1, label: 'Lv.1', values: ['100%'] },
  { level: 9, label: 'Lv.9', values: ['180%'] },
  { level: 10, label: 'M1', values: ['200%'] },
  { level: 12, label: 'M3', values: ['240%'] },
]

it('shows only the highest skill level by default', () => {
  expect(getVisibleSkillLevels(skillLevels, false)).toEqual([skillLevels.at(-1)])
  expect(getVisibleSkillLevels(skillLevels, true)).toEqual(skillLevels)
})

const weaponSkillLevels: WikiSkillLevel[] = [
  { level: 1, description: { 'zh-CN': 'Lv.1', en: 'Lv.1', ja: 'Lv.1', 'zh-TW': 'Lv.1' } },
  { level: 9, description: { 'zh-CN': 'Lv.9', en: 'Lv.9', ja: 'Lv.9', 'zh-TW': 'Lv.9' } },
]

it('shows only the highest weapon skill level by default', () => {
  expect(getVisibleSkillLevels(weaponSkillLevels, false)).toEqual([weaponSkillLevels.at(-1)])
  expect(getVisibleSkillLevels(weaponSkillLevels, true)).toEqual(weaponSkillLevels)
})

it('merges only adjacent equal equipment values', () => {
  expect(getAdjacentSpans([1, 1, 2, 1])).toEqual([2, 0, 1, 1])
  const stat: WikiEquipmentStat = { attributeId: 'Sub', values: [0.2, 0.25, 0.3, 0.35] }
  expect(getEquipmentStatValues(stat)).toEqual([0.2, 0.25, 0.3, 0.35])
})

it('uses the widest value from all levels for stable table sizing', () => {
  expect(getWidestTableValue([9.27835, 89.07216, null])).toBe('89.07216')
  expect(getWidestTableValue([undefined, ''])).toBe('—')
})



it('prefers original voice actor spelling and falls back to the UI locale', () => {
  const original: WikiCharacterVoiceName = {
    language: 'ko',
    original: '김순미',
    localized: { 'zh-CN': '金顺美', en: 'KIM SOONMI', ja: 'キム・スンミ', 'zh-TW': '金順美' },
  }
  const fallback: WikiCharacterVoiceName = {
    ...original,
    original: '',
  }

  expect(getVoiceActorDisplayName(original, 'en')).toBe('김순미')
  expect(getVoiceActorDisplayName(fallback, 'en')).toBe('KIM SOONMI')
})

it('shows only named upstream skill forms', () => {
  const base: WikiCharacterSkill = {
    id: 'ultimate',
    typeId: '2',
    name: { 'zh-CN': '破晦', en: 'Ultimate', ja: '必殺技', 'zh-TW': '破晦' },
    description: { 'zh-CN': '描述', en: 'Description', ja: '説明', 'zh-TW': '描述' },
    iconId: 'ultimate-a',
    metrics: [],
    levels: skillLevels,
  }
  expect(getSkillDisplayVariants(base)).toEqual([])

  const variants = [
    {
      id: 'form-int',
      name: { 'zh-CN': '阵诀·智', en: 'INT', ja: '知', 'zh-TW': '陣訣·智' },
      condition: { 'zh-CN': '智识≥意志', en: 'INT ≥ WILL', ja: '知性≥意志', 'zh-TW': '智識≥意志' },
      description: { 'zh-CN': '伤害更高', en: 'More damage', ja: '高ダメージ', 'zh-TW': '傷害更高' },
      iconId: 'ultimate-a',
      metrics: [],
      levels: skillLevels,
    },
    {
      id: 'form-will',
      name: { 'zh-CN': '阵诀·意', en: 'WILL', ja: '意', 'zh-TW': '陣訣·意' },
      condition: { 'zh-CN': '意志>智识', en: 'WILL > INT', ja: '意志>知性', 'zh-TW': '意志>智識' },
      description: { 'zh-CN': '牵引敌人', en: 'Pull enemies', ja: '牽引', 'zh-TW': '牽引敵人' },
      iconId: 'ultimate-b',
      metrics: [],
      levels: skillLevels,
    },
  ]
  expect(getSkillDisplayVariants({ ...base, variants })).toBe(variants)
})

it('renders a stable overview anchor for Wiki navigation', () => {
  const html = renderToStaticMarkup(
    <WikiDetailHero
      name="Test"
      rarity={6}
      imagePath="/test.avif"
      meta={<span>Meta</span>}
    />,
  )

  expect(html).toContain('id="overview"')
  expect(html).toContain('scroll-mt-4')
})


it('uses eased progress for animated Wiki section navigation', () => {
  expect(easeWikiScroll(0)).toBe(0)
  expect(easeWikiScroll(0.5)).toBeCloseTo(0.875)
  expect(easeWikiScroll(1)).toBe(1)
})
