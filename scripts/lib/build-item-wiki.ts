import type {
  WikiEquipmentDetailMap,
  WikiEquipmentStat,
  WikiEquipmentSummary,
  WikiMaterial,
  WikiEquipmentSuitEffect,
  WikiStatValue,
  WikiWeaponDetailMap,
  WikiWeaponSkill,
  WikiWeaponSummary,
} from '../../src/types/wiki'
import type { AttrShowConfig } from './equip-stat-format'
import { formatEquipStat, resolveFormat } from './equip-stat-format'
import {
  collectWikiBlackboard,
  localizeWikiDescription,
  localizeWikiText,
  numberValue,
  type BlackboardValue,
  type Numeric,
  type TextRef,
  type WikiTextTables,
} from './wiki-builder-utils'

interface ItemEntry {
  name?: TextRef
  iconId?: string
  rarity?: Numeric
}

interface WeaponBasicEntry {
  maxLv?: Numeric
  weaponType?: Numeric
  levelTemplateId?: string
  breakthroughTemplateId?: string
  weaponSkillList?: string[]
}

interface WeaponLevel {
  weaponLv?: Numeric
  baseAtk?: Numeric
}

interface WeaponUpgradeTemplate {
  list?: WeaponLevel[]
}

interface RequiredItem {
  id?: string
  count?: Numeric
}

interface WeaponBreakthrough {
  breakthroughShowLv?: Numeric
  breakthroughLv?: Numeric
  breakItemList?: RequiredItem[]
  breakthroughGold?: Numeric
}

interface WeaponBreakthroughTemplate {
  list?: WeaponBreakthrough[]
}

interface SkillPatch {
  level?: Numeric
  skillName?: TextRef
  description?: TextRef
  iconId?: string
  blackboard?: BlackboardValue[]
}

interface SkillPatchEntry {
  SkillPatchDataBundle?: SkillPatch[]
}

interface EquipAttribute {
  attrIndex?: Numeric
  attrType?: Numeric
  compositeAttr?: string
  attrValues?: Numeric[]
}

interface DisplayEquipAttribute {
  attrIndex?: Numeric
  attrType?: Numeric
  compositeAttr?: string
  attrValue?: Numeric
  enhancedAttrValues?: Numeric[]
  modifierType?: Numeric
}

interface EquipEntry {
  partType?: Numeric
  suitID?: string
  minWearLv?: Numeric
  equipAttrModifiers?: EquipAttribute[]
  displayAttrModifiers?: DisplayEquipAttribute[]
  displayBaseAttrModifier?: DisplayEquipAttribute
}

interface EquipSuitEffect {
  suitName?: TextRef
  skillID?: string
  equipCnt?: Numeric
}

interface EquipSuitEntry {
  list?: EquipSuitEffect[]
}

interface EquipFormula {
  outcomeEquipId?: string
  level?: string
}

interface EquipFormulaChain {
  chainId?: Numeric
  cnDiscount?: Numeric
  isDefault?: boolean
  costItemId?: string[]
  costItemNum?: Numeric[]
  costGoldId?: string
  costGoldNum?: Numeric
}

interface EquipFormulaChainEntry {
  chainList?: EquipFormulaChain[]
}

export interface ItemWikiSource {
  itemTable: Record<string, ItemEntry>
  weaponBasicTable: Record<string, WeaponBasicEntry>
  weaponUpgradeTemplateTable: Record<string, WeaponUpgradeTemplate>
  weaponBreakthroughTemplateTable: Record<string, WeaponBreakthroughTemplate>
  skillPatchTable: Record<string, SkillPatchEntry>
  equipTable: Record<string, EquipEntry>
  equipSuitTable: Record<string, EquipSuitEntry>
  equipFormulaTable: Record<string, EquipFormula>
  equipFormulaChainTable: Record<string, EquipFormulaChainEntry>
  equipStatFormats?: {
    attrTypeMap: Map<number, AttrShowConfig>
    compositeCfg: Map<string, AttrShowConfig>
  }
  textTables: WikiTextTables
}

export interface ItemWikiData {
  weaponSummaries: WikiWeaponSummary[]
  weaponDetails: WikiWeaponDetailMap
  equipmentSummaries: WikiEquipmentSummary[]
  equipmentDetails: WikiEquipmentDetailMap
}

function buildMaterial(
  source: ItemWikiSource,
  itemId: string,
  count: Numeric | undefined
): WikiMaterial {
  const item = source.itemTable[itemId]
  return {
    itemId,
    name: localizeWikiText(item?.name, source.textTables),
    iconId: item?.iconId ?? itemId,
    rarity: numberValue(item?.rarity, 1),
    count: numberValue(count),
  }
}

function buildWeaponSkills(
  skillIds: string[] | undefined,
  source: ItemWikiSource
): WikiWeaponSkill[] {
  return (skillIds ?? []).flatMap((id) => {
    const patches = source.skillPatchTable[id]?.SkillPatchDataBundle ?? []
    const first = patches[0]
    if (!first) return []
    const levels = patches.map((patch, index) => ({
      level: numberValue(patch.level, index + 1),
      description: localizeWikiDescription(
        patch.description ?? first.description,
        source.textTables,
        collectWikiBlackboard(patch.blackboard)
      ),
    }))
    return [{
      id,
      name: localizeWikiText(first.skillName, source.textTables),
      description: levels.at(-1)?.description ?? localizeWikiText(first.description, source.textTables),
      levels,
    }]
  })
}

function buildWeaponBreakthroughs(
  weapon: WeaponBasicEntry,
  levels: Array<{ level: number; baseAttack: number }>,
  source: ItemWikiSource
) {
  const template = weapon.breakthroughTemplateId
    ? source.weaponBreakthroughTemplateTable[weapon.breakthroughTemplateId]
    : undefined
  return (template?.list ?? [])
    .filter((entry) => numberValue(entry.breakthroughShowLv) > 0)
    .map((entry) => {
      const requiredLevel = numberValue(entry.breakthroughLv)
      const materials = (entry.breakItemList ?? [])
        .filter((item): item is RequiredItem & { id: string } => Boolean(item.id) && numberValue(item.count) > 0)
        .map((item) => buildMaterial(source, item.id, item.count))
      const gold = numberValue(entry.breakthroughGold)
      if (gold > 0) materials.push(buildMaterial(source, 'item_gold', gold))
      const baseAttack = levels.find((level) => level.level === requiredLevel)?.baseAttack
      const stats: WikiStatValue[] = baseAttack === undefined
        ? []
        : [{ attributeId: 'baseAttack', value: baseAttack }]
      return {
        stage: numberValue(entry.breakthroughShowLv),
        requiredLevel,
        stats,
        materials,
      }
    })
}

function buildEquipmentStats(equipment: EquipEntry, source: ItemWikiSource): WikiEquipmentStat[] {
  const displayModifiers = [
    ...(equipment.displayBaseAttrModifier ? [equipment.displayBaseAttrModifier] : []),
    ...(equipment.displayAttrModifiers ?? []),
  ]
  if (displayModifiers.length > 0) {
    return displayModifiers.map((modifier) => {
      const attributeId = modifier.compositeAttr || String(modifier.attrType ?? '')
      const rawModifier = (equipment.equipAttrModifiers ?? []).find(
        (candidate) => numberValue(candidate.attrIndex, -1) === numberValue(modifier.attrIndex, -2)
      )
      const sourceValues = modifier.enhancedAttrValues?.length
        ? [modifier.attrValue, ...modifier.enhancedAttrValues]
        : rawModifier?.attrValues ?? [modifier.attrValue]
      const values = sourceValues
        .filter((value): value is Numeric => value !== undefined)
        .map((value) => numberValue(value))
      const config = modifier.compositeAttr
        ? source.equipStatFormats?.compositeCfg.get(modifier.compositeAttr)
        : source.equipStatFormats?.attrTypeMap.get(numberValue(modifier.attrType))
      const displayValues = config && modifier.modifierType !== undefined
        ? values.map((value) => formatEquipStat(config.name, String(value), resolveFormat(config, attributeId, numberValue(modifier.modifierType))))
        : undefined
      return { attributeId, values, ...(displayValues ? { displayValues } : {}) }
    })
  }

  return (equipment.equipAttrModifiers ?? []).map((modifier) => ({
    attributeId: modifier.compositeAttr || String(modifier.attrType ?? ''),
    values: (modifier.attrValues ?? []).map((value) => numberValue(value)),
  }))
}

function buildSuitEffects(
  suitId: string | undefined,
  source: ItemWikiSource
): WikiEquipmentSuitEffect[] {
  if (!suitId) return []
  return (source.equipSuitTable[suitId]?.list ?? []).flatMap((effect) => {
    const skillId = effect.skillID
    const patch = skillId
      ? source.skillPatchTable[skillId]?.SkillPatchDataBundle?.[0]
      : undefined
    if (!skillId || !patch) return []
    return [{
      id: skillId,
      name: localizeWikiText(effect.suitName, source.textTables),
      description: localizeWikiDescription(
        patch.description,
        source.textTables,
        collectWikiBlackboard(patch.blackboard)
      ),
      iconId: patch.iconId || undefined,
      requiredPieces: numberValue(effect.equipCnt),
    }]
  })
}

function buildCraftingRecipes(equipmentId: string, source: ItemWikiSource) {
  const formula = Object.values(source.equipFormulaTable).find(
    (entry) => entry.outcomeEquipId === equipmentId
  )
  if (!formula?.level) return []
  return (source.equipFormulaChainTable[formula.level]?.chainList ?? []).map((chain) => {
    const materials = (chain.costItemId ?? []).map((itemId, index) =>
      buildMaterial(source, itemId, chain.costItemNum?.[index])
    )
    if (chain.costGoldId && numberValue(chain.costGoldNum) > 0) {
      materials.push(buildMaterial(source, chain.costGoldId, chain.costGoldNum))
    }
    return {
      chainId: numberValue(chain.chainId),
      discount: numberValue(chain.cnDiscount, 1),
      isDefault: Boolean(chain.isDefault),
      materials,
    }
  })
}

export function buildItemWikiData(source: ItemWikiSource): ItemWikiData {
  const weaponSummaries: WikiWeaponSummary[] = []
  const weaponDetails: WikiWeaponDetailMap = {}
  for (const [id, weapon] of Object.entries(source.weaponBasicTable)) {
    if (!id.startsWith('wpn_')) continue
    const item = source.itemTable[id]
    const maxLevel = numberValue(weapon.maxLv)
    const levels = (
      weapon.levelTemplateId
        ? source.weaponUpgradeTemplateTable[weapon.levelTemplateId]?.list ?? []
        : []
    )
      .map((entry) => ({
        level: numberValue(entry.weaponLv),
        baseAttack: numberValue(entry.baseAtk),
      }))
      .filter((entry) => entry.level > 0 && entry.level <= maxLevel)
    weaponSummaries.push({
      id,
      category: 'weapons',
      name: localizeWikiText(item?.name, source.textTables),
      rarity: numberValue(item?.rarity),
      imageId: item?.iconId ?? id,
      weaponTypeId: String(weapon.weaponType ?? ''),
      maxLevel,
    })
    weaponDetails[id] = {
      id,
      category: 'weapons',
      maxLevel,
      levels,
      breakthroughs: buildWeaponBreakthroughs(weapon, levels, source),
      skills: buildWeaponSkills(weapon.weaponSkillList, source),
    }
  }

  const equipmentSummaries: WikiEquipmentSummary[] = []
  const equipmentDetails: WikiEquipmentDetailMap = {}
  for (const [id, equipment] of Object.entries(source.equipTable)) {
    if (!id.startsWith('item_equip_')) continue
    const item = source.itemTable[id]
    const suitId = equipment.suitID || undefined
    const suit = suitId ? source.equipSuitTable[suitId]?.list?.[0] : undefined
    equipmentSummaries.push({
      id,
      category: 'equipment',
      name: localizeWikiText(item?.name, source.textTables),
      rarity: numberValue(item?.rarity),
      imageId: item?.iconId ?? id,
      partTypeId: String(equipment.partType ?? ''),
      suitId,
      suitName: suit ? localizeWikiText(suit.suitName, source.textTables) : undefined,
      minimumLevel: numberValue(equipment.minWearLv),
    })
    equipmentDetails[id] = {
      id,
      category: 'equipment',
      stats: buildEquipmentStats(equipment, source),
      suitEffects: buildSuitEffects(suitId, source),
      craftingRecipes: buildCraftingRecipes(id, source),
    }
  }

  return { weaponSummaries, weaponDetails, equipmentSummaries, equipmentDetails }
}
