import { expect, it } from 'vitest'
import { collectWikiAssets } from './wiki-assets'

const name = { 'zh-CN': '名称', en: 'Name', ja: '名称', 'zh-TW': '名稱' }

it('collects every image referenced by Wiki summaries and details', () => {
  const assets = collectWikiAssets({
    characters: {
      summaries: [{
        id: 'chr_test',
        category: 'characters',
        name,
        rarity: 6,
        imageId: 'chr_test',
        elementId: 'Physical',
        professionId: '0',
        factionId: 'ENDFIELD INDUSTRIES',
        weaponTypeId: '1',
        mainAttributeId: '39',
        subAttributeId: '40',
      }],
      details: {
        chr_test: {
          id: 'chr_test',
          category: 'characters',
          maxLevel: 90,
          levels: [],
          skills: [{
            id: 'skill',
            typeId: '1',
            name,
            description: name,
            iconId: 'skill_icon',
            metrics: [],
            levels: [],
          }],
          talents: [{ id: 'talent', name, description: name, iconId: 'talent_icon', breakStage: 2, materials: [] }],
          attributeNodes: [],
          logisticsNodes: [],
          potentials: [{ id: 'potential', level: 1, name, description: name, imageIds: ['potential_image'] }],
          logisticsSkills: [{ id: 'logistics', name, description: name, iconId: 'logistics_icon', unlockHint: name }],
          promotions: [{
            breakStage: 1,
            requiredLevel: 20,
            materials: [{ itemId: 'material', name, iconId: 'material_icon', rarity: 4, count: 3 }],
          }],
          cvNames: [
            { language: 'zh-CN', original: '中文', localized: name },
            { language: 'en', original: 'English', localized: name },
            { language: 'ja', original: '日本語', localized: name },
            { language: 'ko', original: '한국어', localized: name },
          ],
          images: {
            defaultAvatarId: 'chr_test',
            fullBodyIds: { default: 'chr_test', female: 'chr_test-female', male: 'chr_test-male' },
          },
        },
      },
    },
    items: {
      weaponSummaries: [{
        id: 'wpn_test',
        category: 'weapons',
        name,
        rarity: 6,
        imageId: 'weapon_icon',
        weaponTypeId: '1',
        maxLevel: 90,
      }],
      weaponDetails: {
        wpn_test: {
          id: 'wpn_test',
          category: 'weapons',
          maxLevel: 90,
          levels: [],
          skills: [],
          breakthroughs: [{
            stage: 1,
            requiredLevel: 20,
            stats: [],
            materials: [{ itemId: 'weapon_material', name, iconId: 'weapon_material_icon', rarity: 3, count: 5 }],
          }],
        },
      },
      equipmentSummaries: [{
        id: 'equip_test',
        category: 'equipment',
        name,
        rarity: 5,
        imageId: 'equip_icon',
        partTypeId: '0',
        minimumLevel: 80,
      }],
      equipmentDetails: {
        equip_test: {
          id: 'equip_test',
          category: 'equipment',
          stats: [],
          suitEffects: [],
          craftingRecipes: [{ chainId: 4000, discount: 1, isDefault: true, materials: [{ itemId: 'equip_material', name, iconId: 'equip_material_icon', rarity: 2, count: 12 }] }],
        },
      },
    },
  })

  expect(assets).toEqual({
    characters: ['chr_test'],
    characterFullBody: ['chr_test', 'chr_test-female', 'chr_test-male'],
    characterPotential: ['potential_image'],
    weapons: ['weapon_icon'],
    equipment: ['equip_icon'],
    skills: ['skill_icon', 'talent_icon'],
    logisticsSkills: ['logistics_icon'],
    materials: ['equip_material_icon', 'material_icon', 'weapon_material_icon'],
  })
})
