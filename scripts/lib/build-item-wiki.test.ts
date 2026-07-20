import { expect, it } from 'vitest'
import { buildItemWikiData } from './build-item-wiki'

const textTables = {
  'zh-CN': {
    weapon_name: '测试武器',
    weapon_skill: '武器技能',
    weapon_desc: '伤害 +{damage:0%}',
    equip_name: '测试护甲',
    suit_name: '测试套装',
    suit_desc: '攻击力 +{attack:0%}',
    material_name: '测试材料',
  },
  en: {
    weapon_name: 'Test Weapon',
    weapon_skill: 'Weapon Skill',
    weapon_desc: 'Damage +{damage:0%}',
    equip_name: 'Test Armor',
    suit_name: 'Test Set',
    suit_desc: 'ATK +{attack:0%}',
    material_name: 'Test Material',
  },
  ja: {},
  'zh-TW': {},
}

const input = {
  itemTable: {
    wpn_sword_test: { name: { id: 'weapon_name' }, iconId: 'weapon_icon', rarity: '6' },
    item_equip_t4_test_body: { name: { id: 'equip_name' }, iconId: 'equip_icon', rarity: '5' },
    item_material: { name: { id: 'material_name' }, iconId: 'material_icon', rarity: '3' },
    item_gold: { name: { id: 'material_name' }, iconId: 'gold', rarity: '1' },
  },
  weaponBasicTable: {
    wpn_sword_test: {
      maxLv: '90',
      weaponType: '1',
      levelTemplateId: 'curve',
      breakthroughTemplateId: 'breakthrough',
      weaponSkillList: ['weapon_skill'],
    },
  },
  weaponUpgradeTemplateTable: {
    curve: { list: [{ weaponLv: '1', baseAtk: '50' }, { weaponLv: '90', baseAtk: '500' }] },
  },
  weaponBreakthroughTemplateTable: {
    breakthrough: {
      list: [
        {
          breakthroughShowLv: '1',
          breakthroughLv: '20',
          breakItemList: [{ id: 'item_material', count: '5' }],
          breakthroughGold: '1200',
        },
      ],
    },
  },
  skillPatchTable: {
    weapon_skill: {
      SkillPatchDataBundle: [
        {
          level: '1',
          skillName: { id: 'weapon_skill' },
          description: { id: 'weapon_desc' },
          blackboard: [{ key: 'damage', value: '0.2' }],
        },
        {
          level: '2',
          skillName: { id: 'weapon_skill' },
          description: { id: 'weapon_desc' },
          blackboard: [{ key: 'damage', value: '0.3' }],
        },
      ],
    },
    suit_skill: {
      SkillPatchDataBundle: [
        {
          level: '1',
          description: { id: 'suit_desc' },
          blackboard: [{ key: 'attack', value: '0.25' }],
        },
      ],
    },
  },
  equipTable: {
    item_equip_t4_test_body: {
      partType: '0',
      suitID: 'suit_test',
      minWearLv: '80',
      displayBaseAttrModifier: { attrIndex: '0', attrType: '3', attrValue: '40', modifierType: '5' },
      displayAttrModifiers: [
        {
          attrIndex: '3',
          attrType: '0',
          compositeAttr: 'Sub',
          attrValue: '0.2',
          enhancedAttrValues: ['0.25', '0.3', '0.35'],
          modifierType: '6',
        },
      ],
      equipAttrModifiers: [
        { attrIndex: '0', attrType: '3', attrValues: ['40', '45', '50', '55'] },
        { attrType: '39', attrValues: ['60', '65', '70', '75'] },
      ],
    },
  },
  equipSuitTable: {
    suit_test: {
      list: [{ suitName: { id: 'suit_name' }, skillID: 'suit_skill', equipCnt: '3' }],
    },
  },
  equipFormulaTable: {
    formula_test: { outcomeEquipId: 'item_equip_t4_test_body', level: 'T4' },
  },
  equipFormulaChainTable: {
    T4: {
      chainList: [
        {
          isDefault: true,
          chainId: '4000',
          cnDiscount: '1',
          costItemId: ['item_material'],
          costItemNum: ['12'],
          costGoldId: 'item_gold',
          costGoldNum: '9000',
        },
        {
          isDefault: false,
          costItemId: ['item_material'],
          costItemNum: ['5'],
          chainId: '4003',
          cnDiscount: '0.01',
          costGoldId: 'item_gold',
          costGoldNum: '4500',
        },
      ],
    },
  },
      equipStatFormats: {
        attrTypeMap: new Map([[3, { name: '防御力', entries: [{ attributeModifier: 5, showPercent: false, valueFormat: '' }] }]]),
        compositeCfg: new Map([['Sub', { name: '副能力', entries: [{ attributeModifier: 6, showPercent: true, valueFormat: '{value:0.0%}' }] }]]),
      },
  textTables,
}

it('builds complete localized weapon summaries and details', () => {
  const result = buildItemWikiData(input)
  const summary = result.weaponSummaries[0]
  const detail = result.weaponDetails.wpn_sword_test

  expect(summary).toMatchObject({
    id: 'wpn_sword_test',
    name: { en: 'Test Weapon' },
    rarity: 6,
    imageId: 'weapon_icon',
    weaponTypeId: '1',
    maxLevel: 90,
  })
  expect(detail.levels).toEqual([{ level: 1, baseAttack: 50 }, { level: 90, baseAttack: 500 }])
  expect(detail.skills[0]).toMatchObject({
    name: { en: 'Weapon Skill' },
    levels: [
      { level: 1, description: { en: 'Damage +20%' } },
      { level: 2, description: { en: 'Damage +30%' } },
    ],
  })
  expect(detail.breakthroughs[0]).toMatchObject({
    stage: 1,
    requiredLevel: 20,
    materials: [
      { itemId: 'item_material', count: 5 },
      { itemId: 'item_gold', count: 1200 },
    ],
  })
})

it('builds every equipment item with stats, suit effect, and crafting materials', () => {
  const result = buildItemWikiData(input)
  const summary = result.equipmentSummaries[0]
  const detail = result.equipmentDetails.item_equip_t4_test_body

  expect(summary).toMatchObject({
    id: 'item_equip_t4_test_body',
    name: { en: 'Test Armor' },
    rarity: 5,
    partTypeId: '0',
    suitId: 'suit_test',
    suitName: { en: 'Test Set' },
    minimumLevel: 80,
  })
  expect(detail.stats).toEqual([
    { attributeId: '3', values: [40, 45, 50, 55], displayValues: ['防御力+40', '防御力+45', '防御力+50', '防御力+55'] },
    { attributeId: 'Sub', values: [0.2, 0.25, 0.3, 0.35], displayValues: ['副能力+20%', '副能力+25%', '副能力+30%', '副能力+35%'] },
  ])
  expect(detail.suitEffects[0]).toMatchObject({
    id: 'suit_skill',
    name: { en: 'Test Set' },
    description: { en: 'ATK +25%' },
    requiredPieces: 3,
  })
  expect(detail.craftingRecipes).toEqual([
    {
      chainId: 4000,
      discount: 1,
      isDefault: true,
      materials: [
        expect.objectContaining({ itemId: 'item_material', count: 12 }),
        expect.objectContaining({ itemId: 'item_gold', count: 9000 }),
      ],
    },
    {
      chainId: 4003,
      discount: 0.01,
      isDefault: false,
      materials: [
        expect.objectContaining({ itemId: 'item_material', count: 5 }),
        expect.objectContaining({ itemId: 'item_gold', count: 4500 }),
      ],
    },
  ])
})
