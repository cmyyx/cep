import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CharacterWikiData } from './build-character-wiki'
import type { ItemWikiData } from './build-item-wiki'
import { localizeWikiText, type TextRef } from './wiki-builder-utils'
import { loadAllTextTables } from './stat-mapping'
import { parseJsonSafe } from './json-utils'
import type { PlannerGameData, PlannerMaterialTuple, PlannerMaterialData } from '../../src/types/planner'

interface CharacterLevelUpRow { exp?: number | string; gold?: number | string }
interface WeaponLevelSource { weaponLv?: number | string; lvUpExp?: number | string; lvUpGold?: number | string }
interface WeaponBasicSource { levelTemplateId?: string }
interface ItemSource { name?: TextRef; iconId?: string; rarity?: number | string }
interface RewardBundle { id?: string; count?: number | string }
interface RewardSource { itemBundles?: RewardBundle[] }
interface DungeonSeriesSource { name?: TextRef }
interface DungeonSource {
  dungeonId?: string
  dungeonCategory?: string
  dungeonSeriesId?: string
  recommendLv?: number | string
  costStamina?: number | string
  rewardId?: string
  customRewardId?: string
  hunterModeRewardId?: string
  hunterModeCostStamina?: number | string
  dungeonName?: TextRef
}
const STAGE_ONE_EXP_ID = 'item_expcard_stage1_high'
const STAGE_TWO_EXP_ID = 'item_expcard_stage2_high'
const WEAPON_EXP_ID = 'item_weapon_expcard_high'
const DERIVED_ATTRIBUTE_KEYS = ['atkRateOfMain', 'atkRateOfSub', 'efficiencyOfAGI', 'efficiencyOfDEF', 'efficiencyOfSTR', 'efficiencyOfWISD', 'recoverEfficiencyOfWILL'] as const
const GOLD_ID = 'item_gold'



function numeric(value: number | string | undefined): number {
  const result = Number(value ?? 0)
  return Number.isFinite(result) ? result : 0
}

function materials(values: Array<{ itemId: string; count: number }>): PlannerMaterialTuple[] {
  return values.map((value) => [value.itemId, value.count] as const)
}

const STATIC_SET_VALUE_LABELS: Record<string, string> = {
  str_up: '力量',
  agi_up: '敏捷',
  wisd_up: '智识',
  will_up: '意志',
  hp_up: '生命值',
  atk_up: '攻击力',
}

function staticSetValues(effect: ItemWikiData['equipmentDetails'][string]['suitEffects'][number]): Record<string, number> {
  const summary = effect.description['zh-CN'].split('\n')[0] ?? ''
  return Object.fromEntries(
    Object.entries(effect.values).filter(([key]) => {
      const label = STATIC_SET_VALUE_LABELS[key]
      return label !== undefined && summary.includes(label)
    })
  )
}

function addMaterialMetadata(
  target: Record<string, PlannerMaterialData>,
  value: PlannerMaterialData & { itemId: string }
): void {
  if (!target[value.itemId]) {
    target[value.itemId] = { name: value.name, iconId: value.iconId, rarity: value.rarity, ...(value.expValue ? { expValue: value.expValue } : {}) }
  }
}

export function buildPlannerGameData(
  akedataPath: string,
  characters: CharacterWikiData,
  items: ItemWikiData
): PlannerGameData {
  const textTables = loadAllTextTables(akedataPath)
  const table = (name: string) => parseJsonSafe(join(akedataPath, 'TableCfg', `${name}.json`)) as Record<string, unknown>
  const battleConst = table('BattleConst') as Record<string, unknown>
  const derivedAttributes: PlannerGameData['derivedAttributes'] = {
    atkRateOfMain: numeric(battleConst.atkRateOfMain as number | string | undefined),
    atkRateOfSub: numeric(battleConst.atkRateOfSub as number | string | undefined),
    efficiencyOfAGI: numeric(battleConst.efficiencyOfAGI as number | string | undefined),
    efficiencyOfDEF: numeric(battleConst.efficiencyOfDEF as number | string | undefined),
    efficiencyOfSTR: numeric(battleConst.efficiencyOfSTR as number | string | undefined),
    efficiencyOfWISD: numeric(battleConst.efficiencyOfWISD as number | string | undefined),
    recoverEfficiencyOfWILL: numeric(battleConst.recoverEfficiencyOfWILL as number | string | undefined),
  }
  const characterLevelUp = table('CharLevelUpTable') as Record<string, CharacterLevelUpRow>
  const weaponBasic = table('WeaponBasicTable') as Record<string, WeaponBasicSource>
  const weaponUpgrade = table('WeaponUpgradeTemplateTable') as Record<string, { list?: WeaponLevelSource[] }>
  const itemTable = table('ItemTable') as Record<string, ItemSource>
  const dungeonTable = table('DungeonTable') as Record<string, DungeonSource>
  const dungeonSeriesTable = table('DungeonSeriesTable') as Record<string, DungeonSeriesSource>
  const rewardTable = table('RewardTable') as Record<string, RewardSource>
  const expItemMap = table('ExpItemDataMap') as Record<string, { expGain?: number; expType?: number }>
  const weaponExpItemTable = table('WeaponExpItemTable') as Record<string, { expItemId?: string; itemExp?: number }>
  const summaries = new Map(characters.summaries.map((summary) => [summary.id, summary]))
  const metadata: Record<string, PlannerMaterialData> = {}

  const collectMaterials = (values: Array<{ itemId: string } & PlannerMaterialData>) => {
    for (const material of values) addMaterialMetadata(metadata, material)
  }
  for (const detail of Object.values(characters.details)) {
    for (const skill of detail.skills) for (const level of skill.levels) collectMaterials(level.materials ?? [])
    for (const talent of detail.talents) collectMaterials(talent.materials)
    for (const node of detail.attributeNodes) collectMaterials(node.materials)
    for (const node of detail.equipmentNodes) collectMaterials(node.materials)
    for (const node of detail.logisticsNodes) collectMaterials(node.materials)
    for (const promotion of detail.promotions) collectMaterials(promotion.materials)
  }
  for (const detail of Object.values(items.weaponDetails)) {
    for (const breakthrough of detail.breakthroughs) collectMaterials(breakthrough.materials)
  }
  for (const detail of Object.values(items.equipmentDetails)) {
    for (const recipe of detail.craftingRecipes) collectMaterials(recipe.materials)
  }
  const resourceIds = [STAGE_ONE_EXP_ID, STAGE_TWO_EXP_ID, WEAPON_EXP_ID, GOLD_ID]
  for (const itemId of resourceIds) {
    const source = itemTable[itemId]
    if (source) {
      addMaterialMetadata(metadata, {
        itemId,
        name: localizeWikiText(source.name, textTables),
        iconId: source.iconId ?? itemId,
        rarity: numeric(source.rarity),
        expValue: expItemMap[itemId] ? numeric(expItemMap[itemId]?.expGain) : numeric(Object.values(weaponExpItemTable).find((entry) => entry.expItemId === itemId)?.itemExp),
      })
    }
  }

  const characterMap = Object.fromEntries(
    Object.entries(characters.details).map(([id, detail]) => {
      const summary = summaries.get(id)
      return [id, {
        mainAttributeId: summary?.mainAttributeId ?? '39',
        subAttributeId: summary?.subAttributeId ?? '40',
        levels: detail.levels.map((level) => ({
          ...level,
          levelUpExp: numeric(characterLevelUp[String(level.level)]?.exp),
          levelUpGold: numeric(characterLevelUp[String(level.level)]?.gold),
        })),
        skills: detail.skills.map((skill) => ({
          id: skill.id,
          typeId: skill.typeId,
          maxLevel: skill.levels.at(-1)?.level ?? 1,
          name: skill.name,
          iconId: skill.iconId,
          materialsByLevel: skill.levels.map((level) => ({ level: level.level, materials: materials(level.materials ?? []) })),
        })),
        talents: detail.talents.map((talent) => ({ id: talent.id, name: talent.name, breakStage: talent.breakStage, materials: materials(talent.materials) })),
        attributeNodes: detail.attributeNodes.map((node) => ({ id: node.id, name: node.title, breakStage: node.breakStage, favorability: node.favorability, stats: node.stats, materials: materials(node.materials) })),
        equipmentNodes: detail.equipmentNodes.map((node) => ({ id: node.id, name: node.name, breakStage: node.breakStage, equipmentTierLimit: node.equipmentTierLimit, materials: materials(node.materials) })),
        logisticsNodes: detail.logisticsNodes.map((node) => ({
          id: node.id,
          name: detail.logisticsSkills.find((skill) => skill.index === node.index && skill.level === node.level)?.name ?? { 'zh-CN': node.id, en: node.id, ja: node.id, 'zh-TW': node.id },
          breakStage: node.breakStage,
          index: node.index,
          level: node.level,
          materials: materials(node.materials),
        })),
        promotions: detail.promotions.map((promotion) => ({ breakStage: promotion.breakStage, requiredLevel: promotion.requiredLevel, materials: materials(promotion.materials) })),
      }]
    })
  )

  const weaponMap = Object.fromEntries(
    Object.entries(items.weaponDetails).map(([id, detail]) => {
      const templateId = weaponBasic[id]?.levelTemplateId
      const sourceLevels = templateId ? weaponUpgrade[templateId]?.list ?? [] : []
      const levelCosts = new Map(sourceLevels.map((level) => [numeric(level.weaponLv), level]))
      return [id, {
        levels: detail.levels.map((level) => ({ ...level, levelUpExp: numeric(levelCosts.get(level.level)?.lvUpExp), levelUpGold: numeric(levelCosts.get(level.level)?.lvUpGold) })),
        breakthroughs: detail.breakthroughs.map((breakthrough) => ({ stage: breakthrough.stage, requiredLevel: breakthrough.requiredLevel, materials: materials(breakthrough.materials) })),
        skills: detail.skills.map((skill) => ({ id: skill.id, levels: skill.levels })),
      }]
    })
  )

  const equipmentMap = Object.fromEntries(
    Object.entries(items.equipmentDetails).map(([id, detail]) => [id, detail.stats.map((stat) => ({ attributeId: stat.attributeId, values: stat.values, displayValues: stat.displayValues ?? [] }))])
  )
  const equipmentSummaries = new Map(items.equipmentSummaries.map((summary) => [summary.id, summary]))
  const equipmentSuits = Object.fromEntries(
    Object.entries(items.equipmentDetails).map(([id, detail]) => [id, {
      suitId: equipmentSummaries.get(id)?.suitId,
      effects: detail.suitEffects.map((effect) => ({
        id: effect.id,
        requiredPieces: effect.requiredPieces,
        values: effect.values,
        staticValues: staticSetValues(effect),
      })),
    }])
  )

  const rewardYields = (rewardId: string | undefined): PlannerMaterialTuple[] => {
    if (!rewardId) return []
    const totals = new Map<string, number>()
    for (const bundle of rewardTable[rewardId]?.itemBundles ?? []) {
      const itemId = bundle.id
      const count = numeric(bundle.count)
      if (!itemId || count <= 0 || itemId === 'item_adventureexp') continue
      const exp = expItemMap[itemId]
      if (exp) {
        const target = numeric(exp.expType) === 2 ? STAGE_TWO_EXP_ID : STAGE_ONE_EXP_ID
        totals.set(target, (totals.get(target) ?? 0) + count * numeric(exp.expGain))
        continue
      }
      const weaponExp = Object.values(weaponExpItemTable).find((entry) => entry.expItemId === itemId)
      if (weaponExp) {
        totals.set(WEAPON_EXP_ID, (totals.get(WEAPON_EXP_ID) ?? 0) + count * numeric(weaponExp.itemExp))
        continue
      }
      totals.set(itemId, (totals.get(itemId) ?? 0) + count)
    }
    return [...totals.entries()].map(([itemId, count]) => [itemId, count] as const)
  }

  const rewardItems = (rewardId: string | undefined): PlannerMaterialTuple[] => {
    if (!rewardId) return []
    return (rewardTable[rewardId]?.itemBundles ?? []).flatMap((bundle) => {
      const itemId = bundle.id
      const count = numeric(bundle.count)
      if (!itemId || count <= 0 || itemId === 'item_adventureexp') return []
      const source = itemTable[itemId]
      if (source) addMaterialMetadata(metadata, {
        itemId,
        name: localizeWikiText(source.name, textTables),
        iconId: source.iconId ?? itemId,
        rarity: numeric(source.rarity),
      })
      return [[itemId, count] as const]
    })
  }

  const highestBySeries = new Map<string, DungeonSource>()
  for (const dungeon of Object.values(dungeonTable)) {
    if (dungeon.dungeonCategory !== 'dungeon_resource' || !dungeon.dungeonId || !dungeon.dungeonSeriesId) continue
    const current = highestBySeries.get(dungeon.dungeonSeriesId)
    if (!current || numeric(dungeon.recommendLv) > numeric(current.recommendLv)) highestBySeries.set(dungeon.dungeonSeriesId, dungeon)
  }
  const dungeons = [...highestBySeries.values()].flatMap((dungeon) => {
    const id = dungeon.dungeonId as string
    const name = localizeWikiText(dungeon.dungeonName, textTables)
    const seriesId = dungeon.dungeonSeriesId as string
    const seriesName = localizeWikiText(dungeonSeriesTable[seriesId]?.name, textTables)
    const variants = [
      { rewardId: dungeon.rewardId, stamina: numeric(dungeon.costStamina) },
      { rewardId: dungeon.customRewardId, stamina: numeric(dungeon.costStamina) },
      { rewardId: dungeon.hunterModeRewardId, stamina: numeric(dungeon.hunterModeCostStamina) },
    ]
    return variants.filter((variant) => variant.rewardId && variant.stamina > 0).map((variant) => ({
      id,
      name,
      seriesId,
      seriesName,
      rewardId: variant.rewardId as string,
      stamina: variant.stamina,
      yields: rewardYields(variant.rewardId),
      rewardItems: rewardItems(variant.rewardId),
    })).filter((entry) => entry.yields.length > 0)
  })

  return {
    characters: characterMap,
    weapons: weaponMap,
    equipment: equipmentMap,
    materials: metadata,
    equipmentSuits,
    dungeons,
    derivedAttributes,
  }
}
export function writePlannerGameData(dataOutputDir: string, data: PlannerGameData): string {
  const path = join(dataOutputDir, 'planner.ts')
  mkdirSync(dataOutputDir, { recursive: true })
  writeFileSync(path, [
    '// Auto-generated by scripts/lib/generate-planner-data.ts.',
    '// DO NOT EDIT MANUALLY.',
    "import type { PlannerGameData } from '@/types/planner'",
    '',
    `export const plannerGameData: PlannerGameData = ${JSON.stringify(data)}`,
    '',
  ].join('\n'), 'utf8')
  return path
}
