import { expect, it } from 'vitest'
import { buildWikiGlossary, mergeAttributeMapLabels } from './generate-wiki-data'

it('merges complete four-locale attribute maps for attributes absent from display config', () => {
  const labels = mergeAttributeMapLabels({
    'zh-CN': { '25': '物理异常伤害系数', '55': '超域伤害加成', '90': '普攻起始距离' },
    en: { '25': 'Physical Anomaly Damage Multiplier', '55': 'Ether Damage Bonus', '90': 'Basic Attack Start Distance' },
    ja: { '25': '物理異常ダメージ係数', '55': '超域ダメージ加算', '90': '通常攻撃開始距離' },
    'zh-TW': { '25': '物理異常傷害係數', '55': '超域傷害加成', '90': '普攻起始距離' },
  })

  expect(labels['25']).toEqual({
    'zh-CN': '物理异常伤害系数',
    en: 'Physical Anomaly Damage Multiplier',
    ja: '物理異常ダメージ係数',
    'zh-TW': '物理異常傷害係數',
  })
  expect(Object.keys(labels)).toEqual(['25', '55', '90'])
})

it('builds localized glossary terms from the upstream hyperlink table', () => {
  const glossary = buildWikiGlossary({
    'ba.consume': {
      name: { id: 'term_name' },
      desc: { id: 'term_desc' },
      richTextId: 'ba.key',
    },
  }, {
    'zh-CN': { term_name: '消耗', term_desc: '移除状态。' },
    en: { term_name: 'Consume', term_desc: 'Removes the status.' },
    ja: { term_name: '消費', term_desc: '状態を解除する。' },
    'zh-TW': { term_name: '消耗', term_desc: '移除狀態。' },
  })

  expect(glossary['ba.consume']).toEqual({
    name: { 'zh-CN': '消耗', en: 'Consume', ja: '消費', 'zh-TW': '消耗' },
    description: {
      'zh-CN': '移除状态。',
      en: 'Removes the status.',
      ja: '状態を解除する。',
      'zh-TW': '移除狀態。',
    },
    styleId: 'ba.key',
  })
})
