import { describe, expect, it } from 'vitest'
import { buildCharacterWikiData } from './build-character-wiki'

const textTables = {
  'zh-CN': {
    name_admin: '管理员',
    name_old_m: '管理员（男废案）',
    name_old_f: '管理员（女废案）',
    skill_name: '战技',
    skill_desc: '造成 {damage:0%} 伤害',
    metric_damage: '伤害倍率',
    potential_name: '潜能一',
    potential_desc: '攻击力 +{atk-1:0%}',
    mapped_potential_desc: '敏捷 +{Agi:0}，技力消耗降低 {1-costValue:0%}',
    talent_name: '天赋',
    talent_desc: '生命值 +{hp:0}',
    attribute_title: '属性节点',
    attribute_desc: '攻击力 +{atk:0}',
    factory_title: '生产节点',
    factory_desc: '生产效率 +10%',
    logistics_talent: '后勤专长',
    logistics_name: '高效生产',
    logistics_desc: '效率提升 20%',
    item_name: '突破材料',
    element_name: '物理',
    profession_name: '近卫',
    cv_cn: '陈婷婷',
    cv_en: 'Jane Jackson',
    cv_ja: '若山诗音',
    cv_ko: '김철수',
    unlock_e1: '精英化阶段一可解锁',
  },
  en: {
    name_admin: 'Endministrator',
    skill_name: 'Combat Skill',
    skill_desc: 'Deals {damage:0%} damage',
    metric_damage: 'Damage Multiplier',
    potential_name: 'Potential I',
    potential_desc: 'ATK +{atk-1:0%}',
    mapped_potential_desc: 'AGI +{Agi:0}; skill cost -{1-costValue:0%}',
    talent_name: 'Talent',
    talent_desc: 'HP +{hp:0}',
    attribute_title: 'Attribute Node',
    attribute_desc: 'ATK +{atk:0}',
    factory_title: 'Factory Node',
    factory_desc: 'Production +10%',
    logistics_talent: 'Logistics Specialty',
    logistics_name: 'Efficient Production',
    logistics_desc: 'Efficiency +20%',
    item_name: 'Promotion Material',
    element_name: 'Physical',
    profession_name: 'Guard',
    cv_cn: 'Chen Tingting',
    cv_en: 'Jane Jackson',
    cv_ja: 'Shion Wakayama',
    cv_ko: 'Kim Cheolsu',
    unlock_e1: 'Reach E1 to unlock',
  },
  ja: { cv_ja: '若山诗音' },
  'zh-TW': {},
  ko: { cv_ko: '김철수' },
}

function level(level: number, breakStage: number, attack: number) {
  return {
    breakStage,
    Attribute: {
      attrs: [
        { attrType: 0, attrValue: level },
        { attrType: 2, attrValue: attack },
      ],
    },
  }
}

const cvName = {
  ChiCVName: { id: 'cv_cn' },
  EngCVName: { id: 'cv_en' },
  JapCVName: { id: 'cv_ja' },
  KorCVName: { id: 'cv_ko' },
}
const input = {
  attributeVariableNames: { '2': 'atk', '40': 'Agi' },
  characterConst: { maxLevel: 90 },
  characterTable: {
    chr_0002_endminm: {
      charId: 'chr_0002_endminm',
      rarity: 6,
      attributes: [level(1, 0, 10)],
      charTypeId: 'Physical',
      profession: 0,
      department: 'ENDFIELD INDUSTRIES',
      weaponType: 1,
      mainAttrType: 39,
      subAttrType: 40,
    },
    chr_0003_endminf: {
      charId: 'chr_0003_endminf',
      rarity: 6,
      attributes: [level(1, 0, 10)],
      charTypeId: 'Physical',
      profession: 0,
      department: 'ENDFIELD INDUSTRIES',
      weaponType: 1,
      mainAttrType: 39,
      subAttrType: 40,
    },
    chr_9000_endmin: {
      charId: 'chr_9000_endmin',
      rarity: 6,
      attributes: [
        ...Array.from({ length: 90 }, (_, index) => level(index + 1, index >= 20 ? 1 : 0, 100 + index)),
        level(20, 2, 999),
        level(91, 4, 9999),
      ],
      charTypeId: 'Physical',
      profession: 0,
      department: 'ENDFIELD INDUSTRIES',
      weaponType: 1,
      mainAttrType: 39,
      subAttrType: 40,
      name: { id: 'name_admin' },
      cvName,
    },
  },
  characterGrowthTable: {
    chr_9000_endmin: {
      skillGroupMap: {
        group: {
          skillGroupId: 'group',
          skillGroupType: 1,
          icon: 'skill_icon',
          name: { id: 'skill_name' },
          desc: { id: 'skill_desc' },
          skillIdList: ['skill_admin', 'skill_admin_copy'],
        },
        ultimate: {
          skillGroupId: 'ultimate',
          skillGroupType: 2,
          name: { id: 'skill_name' },
          desc: { id: 'skill_desc' },
          skillIdList: ['ultimate_skill', 'ultimate_skill2', 'ultimate_skill3'],
        },
        normal: {
          skillGroupId: 'normal',
          skillGroupType: 0,
          icon: 'icon_attack_sword',
          name: { id: 'skill_name' },
          desc: { id: 'skill_desc' },
          skillIdList: ['invalid_icon_attack', 'valid_icon_attack'],
        },
      },
      skillLevelUp: [
        { skillGroupId: 'group', level: '2', goldCost: '1000', itemBundle: [{ id: 'item_skill', count: '2' }] },
      ],
      talentNodeMap: {
        talent: {
          nodeType: 4,
          requiredItem: [{ id: 'item_talent', count: 4 }],
          passiveSkillNodeInfo: {
            index: 0,
            level: 1,
            talentEffectId: 'talent_effect',
            iconId: 'talent_icon',
            name: { id: 'talent_name' },
            breakStage: 2,
          },
        },
        attribute: {
          nodeType: 3,
          requiredItem: [{ id: 'item_attribute', count: 5 }],
          attributeNodeInfo: {
            title: { id: 'attribute_title' },
            desc: { id: 'attribute_desc' },
            customIcon: 'attribute_icon',
            breakStage: 2,
            favorability: 10,
            attributeModifiers: [{ attrType: 2, attrValue: 7 }],
          },
        },
        factory: {
          nodeType: 5,
          requiredItem: [{ id: 'item_factory', count: 6 }],
          factorySkillNodeInfo: {
            title: { id: 'factory_title' },
            desc: { id: 'factory_desc' },
            customIcon: 'factory_icon',
            breakStage: 3,
            index: 4,
            level: 2,
          },
        },
      },
      charBreakCostMap: {
        charBreak20: {
          nodeType: 1,
          breakStage: 1,
          requiredItem: [{ id: 'item_break', count: 3 }],
        },
      },
    },
  },
  characterPotentialTable: {
    chr_9000_endmin: {
      firstItemId: 'item_charpotentialup_chr_9000_endmin',
      potentialUnlockBundle: [
        {
          level: 1,
          name: { id: 'potential_name' },
          potentialEffectId: 'potential_effect',
          unlockCharPictureItemList: ['item_pic_1_chr_0003_endminf'],
        },
        {
          level: 2,
          name: { id: 'potential_name' },
          potentialEffectId: 'mapped_potential',
          unlockCharPictureItemList: [],
        },
      ],
    },
  },
  potentialTalentEffectTable: {
    potential_effect: {
      desc: { id: 'potential_desc' },
      dataList: [{ attachBuff: { blackboard: [{ key: 'atk', value: 1.25 }] } }],
    },
    talent_effect: {
      desc: { id: 'talent_desc' },
      dataList: [{ attachBuff: { blackboard: [{ key: 'hp', value: 100 }] } }],
    },
    compound_potential: {
      desc: { id: 'potential_desc' },
      dataList: [{ attachBuff: { blackboard: [{ key: 'atk', value: 1.25 }] } }],
    },
    mapped_potential: {
      desc: { id: 'mapped_potential_desc' },
      dataList: [{
        attrModifier: { attrType: 40, attrValue: 15 },
        skillParamModifier: { paramType: 1, paramValue: 0.85 },
      }],
    },
  },
  skillPatchTable: {
    skill_admin: {
      SkillPatchDataBundle: Array.from({ length: 12 }, (_, index) => ({
        level: index + 1,
        iconId: 'skill_icon',
        blackboard: [{ key: 'damage', value: 1.5 + index * 0.1 }],
        coolDown: 20 - index,
        costValue: 100,
        subDescDataList: [{ name: { id: 'metric_damage' }, desc: `${150 + index * 10}%` }],
      })),
    },
    skill_admin_copy: {
      SkillPatchDataBundle: Array.from({ length: 12 }, (_, index) => ({
        level: index + 1,
        iconId: 'skill_icon',
        blackboard: [{ key: 'damage', value: 1.5 + index * 0.1 }],
        coolDown: 20 - index,
        costValue: 100,
        subDescDataList: [{ name: { id: 'metric_damage' }, desc: `${150 + index * 10}%` }],
      })),
    },
    invalid_icon_attack: {
      SkillPatchDataBundle: [{ level: 1, iconId: 's', subDescDataList: [{ name: { id: 'metric_damage' }, desc: '10%' }] }],
    },
    valid_icon_attack: {
      SkillPatchDataBundle: [{ level: 1, iconId: 'icon_attack_sword', subDescDataList: [{ name: { id: 'metric_damage' }, desc: '20%' }] }],
    },
    ultimate_skill: {
      SkillPatchDataBundle: Array.from({ length: 12 }, (_, index) => ({
        level: index + 1,
        iconId: 'icon_ultimate_skill_test_a',
        blackboard: [{ key: 'damage', value: 2 + index * 0.1 }],
        subDescDataList: [{ name: { id: 'metric_damage' }, desc: `${200 + index * 10}%` }],
      })),
    },
    ultimate_skill2: {
      SkillPatchDataBundle: Array.from({ length: 12 }, (_, index) => ({
        level: index + 1,
        iconId: 'icon_ultimate_skill_test_b',
        blackboard: [{ key: 'damage', value: 3 + index * 0.1 }],
        subDescDataList: [{ name: { id: 'metric_damage' }, desc: `${300 + index * 10}%` }],
      })),
    },
    ultimate_skill3: {
      SkillPatchDataBundle: Array.from({ length: 12 }, (_, index) => ({
        level: index + 1,
        iconId: 'icon_attack_sword',
        blackboard: [{ key: 'damage', value: 4 + index * 0.1 }],
        subDescDataList: [{ name: { id: 'metric_damage' }, desc: `${400 + index * 10}%` }],
      })),
    },
  },
  spaceshipCharacterSkillTable: {
    chr_9000_endmin: {
      skillList: [{ skillId: 'logistics_1', unlockHint: { id: 'unlock_e1' } }],
    },
  },
  spaceshipSkillTable: {
    logistics_1: {
      icon: 'logistics_icon',
      talentName: { id: 'logistics_talent' },
      name: { id: 'logistics_name' },
      desc: { id: 'logistics_desc' },
    },
  },
  characterTypeTable: {
    Physical: { name: { id: 'element_name' } },
  },
  characterProfessionTable: {
    '0': { name: { id: 'profession_name' } },
  },
  itemTable: {
    chr_0002_endminm: { name: { id: 'name_old_m' }, iconId: 'chr_0002_endminm', rarity: 6 },
    chr_0003_endminf: { name: { id: 'name_old_f' }, iconId: 'chr_0003_endminf', rarity: 6 },
    chr_9000_endmin: { name: { id: 'name_admin' }, iconId: 'chr_9000_endmin', rarity: 6 },
    item_charpotentialup_chr_9000_endmin: {
      name: { id: 'potential_name' },
      iconId: 'item_charpotentialup_chr_0002_endminm',
      rarity: 6,
    },
    item_break: { name: { id: 'item_name' }, iconId: 'item_break_icon', rarity: 4 },
    item_skill: { name: { id: 'item_name' }, iconId: 'item_skill_icon', rarity: 3 },
    item_talent: { name: { id: 'item_name' }, iconId: 'item_talent_icon' },
    item_attribute: { name: { id: 'item_name' }, iconId: 'item_attribute_icon', rarity: 2 },
    item_factory: { name: { id: 'item_name' }, iconId: 'item_factory_icon', rarity: 5 },
  },
  textTables,
}

it('normalizes the administrator and removes deprecated prototypes', () => {
  const result = buildCharacterWikiData(input)

  expect(result.summaries.map((character) => character.id)).toEqual(['chr_9000_endmin'])
  expect(result.summaries[0].name.en).toBe('Endministrator')
  expect(result.summaries[0].imageId).toBe('chr_9000_endmin')
  expect(result.details.chr_9000_endmin.images).toEqual({
    defaultAvatarId: 'chr_9000_endmin',
    fullBodyIds: {
      default: 'chr_9000_endmin-female',
      female: 'chr_9000_endmin-female',
      male: 'chr_9000_endmin-male',
    },
  })
  expect(result.details.chr_9000_endmin.cvNames).toMatchObject([
    { language: 'zh-CN', original: '陈婷婷', localized: { en: 'Chen Tingting', 'zh-CN': '陈婷婷' } },
    { language: 'en', original: 'Jane Jackson', localized: { en: 'Jane Jackson', 'zh-CN': 'Jane Jackson' } },
    { language: 'ja', original: '若山诗音', localized: { en: 'Shion Wakayama', 'zh-CN': '若山诗音' } },
    { language: 'ko', original: '김철수', localized: { en: 'Kim Cheolsu', 'zh-CN': '김철수' } },
  ])
})

it('omits empty voice references', () => {
  const emptyVoices = structuredClone(input) as unknown as Parameters<typeof buildCharacterWikiData>[0]
  emptyVoices.characterTable.chr_9000_endmin.cvName = {
    ChiCVName: { id: 0 },
    EngCVName: { id: 0 },
    JapCVName: { id: 0 },
    KorCVName: { id: 0 },
  }

  expect(buildCharacterWikiData(emptyVoices).details.chr_9000_endmin.cvNames).toEqual([])
})

it('falls back to CharacterTable when the administrator item name is absent', () => {
  const itemNameMissing = structuredClone(input) as unknown as Parameters<typeof buildCharacterWikiData>[0]
  itemNameMissing.itemTable.chr_9000_endmin.name = undefined

  expect(buildCharacterWikiData(itemNameMissing).summaries[0].name).toMatchObject({
    'zh-CN': '管理员',
    en: 'Endministrator',
  })
})

describe('character detail generation', () => {
  it('keeps one highest-break row for every level through 90', () => {
    const detail = buildCharacterWikiData(input).details.chr_9000_endmin

    expect(detail.levels).toHaveLength(90)
    expect(detail.levels.at(-1)?.level).toBe(90)
    expect(detail.levels.find((row) => row.level === 20)).toMatchObject({
      breakStage: 2,
      isBreakthrough: true,
      stats: [{ attributeId: '2', value: 999 }],
    })
  })

  it('generates skill metric tables with mastery labels', () => {
    const skill = buildCharacterWikiData(input).details.chr_9000_endmin.skills.find((entry) => entry.id === 'group')!

    expect(skill.name.en).toBe('Combat Skill')
    expect(skill.metrics[0]).toMatchObject({ id: 'skill_admin:0', label: { en: 'Damage Multiplier' } })
    expect(skill.levels).toHaveLength(12)
    expect(skill.levels[0]).toMatchObject({ level: 1, label: 'Lv.1', values: ['150%'] })
    expect(skill.metrics).toHaveLength(1)
    expect(skill.levels.every((level) => level.values.length === 1)).toBe(true)
    expect(skill.levels[8].label).toBe('Lv.9')
    expect(skill.levels[9].label).toBe('M1')
    expect(skill.levels[10].label).toBe('M2')
    expect(skill.levels[11]).toMatchObject({ level: 12, label: 'M3', values: ['260%'] })
  })
  it('emits skill costs, true ultimate forms, and growth nodes', () => {
    const detail = buildCharacterWikiData(input).details.chr_9000_endmin
    const skill = detail.skills.find((entry) => entry.id === 'group')
    expect(skill?.levels[0]).not.toHaveProperty('materials')
    expect(skill?.levels[1]).toMatchObject({ goldCost: 1000, materials: [{ itemId: 'item_skill', count: 2, rarity: 3 }] })
    const ultimate = detail.skills.find((entry) => entry.id === 'ultimate')
    expect(ultimate?.variants).toHaveLength(2)
    expect(ultimate?.variants?.map((variant) => variant.iconId)).toEqual(['icon_ultimate_skill_test_a', 'icon_ultimate_skill_test_b'])
    expect(ultimate?.variants?.map((variant) => variant.metrics.length)).toEqual([1, 1])
    expect(ultimate?.variants?.map((variant) => variant.levels.at(-1)?.values.length)).toEqual([1, 1])
    const normal = detail.skills.find((entry) => entry.id === 'normal')
    expect(normal?.variants).toBeUndefined()
    expect(normal?.iconId).toBe('icon_attack_sword')
    expect(detail.talents[0]).toMatchObject({ materials: [{ itemId: 'item_talent', rarity: 1 }] })
    expect(detail.attributeNodes).toMatchObject([{
      title: { en: 'Attribute Node' },
      description: { en: 'ATK +7' },
      stats: [{ attributeId: '2', value: 7 }],
      materials: [{ itemId: 'item_attribute', rarity: 2 }],
    }])
    expect(detail.logisticsNodes).toMatchObject([{
      breakStage: 3,
      index: 4,
      level: 2,
      materials: [{ itemId: 'item_factory', rarity: 5 }],
    }])
  })

  it('includes talents, potentials, logistics skills, and promotion materials', () => {
    const detail = buildCharacterWikiData(input).details.chr_9000_endmin

    expect(detail.talents[0]).toMatchObject({
      description: { en: 'HP +100' },
      iconId: 'talent_icon',
      breakStage: 2,
    })
    expect(detail.potentials[0]).toMatchObject({
      level: 1,
      description: { en: 'ATK +25%' },
      imageIds: ['item_pic_1_chr_0003_endminf'],
    })
    expect('iconId' in detail.potentials[0]).toBe(false)
    expect(detail.potentials[1]).toMatchObject({
      level: 2,
      description: { en: 'AGI +15; skill cost -15%' },
    })
    expect(detail.logisticsSkills[0]).toMatchObject({
      name: { en: 'Efficient Production' },
      description: { en: 'Efficiency +20%' },
      iconId: 'logistics_icon',
      unlockHint: { en: 'Reach E1 to unlock' },
    })
    expect(detail.promotions[0]).toMatchObject({
      breakStage: 1,
      requiredLevel: 20,
      materials: [
        {
          itemId: 'item_break',
          name: { en: 'Promotion Material' },
          iconId: 'item_break_icon',
          count: 3,
        },
      ],
    })
    expect(detail.promotions.flatMap((promotion) => promotion.materials)).toSatisfy(
      (materials: Array<{ name: Record<string, string>; iconId: string }>) =>
        materials.every((material) => material.iconId && Object.values(material.name).every(Boolean))
    )
  })

  it('accepts lossless-json numeric strings from upstream tables', () => {
    const numericStringInput = JSON.parse(
      JSON.stringify(input),
      (_key, value: unknown) => typeof value === 'number' ? String(value) : value
    ) as unknown as Parameters<typeof buildCharacterWikiData>[0]
    const detail = buildCharacterWikiData(numericStringInput).details.chr_9000_endmin

    expect(detail.levels).toHaveLength(90)
    expect(detail.levels.find((row) => row.level === 20)).toMatchObject({
      breakStage: 2,
      stats: [{ attributeId: '2', value: 999 }],
    })
    expect(detail.promotions[0]).toMatchObject({ breakStage: 1, materials: [{ count: 3 }] })
  })
})
