import type {
  LocalizedText,
  WikiCharacterAttributeNode,
  WikiCharacterDetail,
  WikiCharacterDetailMap,
  WikiCharacterLevel,
  WikiCharacterLogisticsNode,
  WikiCharacterLogisticsSkill,
  WikiCharacterPromotion,
  WikiCharacterSkill,
  WikiCharacterSkillVariant,
  WikiCharacterSummary,
  WikiCharacterTalent,
  WikiCharacterVoiceName,
  WikiEnumLabels,
  WikiMaterial,
} from '../../src/types/wiki'
import {
  collectWikiBlackboard as collectBlackboard,
  localizeWikiDescription as localizeDescription,
  localizeWikiText as localize,
  numberValue,
  type BlackboardValue,
  type Numeric,
  type TextRef,
} from './wiki-builder-utils'

const DEPRECATED_CHARACTER_IDS: Record<string, true> = {
  chr_0002_endminm: true,
  chr_0003_endminf: true,
}
const ADMINISTRATOR_ID = 'chr_9000_endmin'
const SKILL_PARAMETER_NAMES: Record<number, string> = {
  1: 'CostValue',
  2: 'CoolDown',
  3: 'MaxChargeTime',
}

interface AttributeValue {
  attrType: Numeric
  attrValue: Numeric
}

interface CharacterAttributeRow {
  breakStage?: Numeric
  Attribute?: { attrs?: AttributeValue[] }
}

interface CharacterCvName {
  ChiCVName?: TextRef
  EngCVName?: TextRef
  JapCVName?: TextRef
  KorCVName?: TextRef
}
interface CharacterTableEntry {
  charId?: string
  attributes?: CharacterAttributeRow[]
  charTypeId?: string
  profession?: Numeric
  department?: string
  weaponType?: Numeric
  mainAttrType?: Numeric
  subAttrType?: Numeric
  rarity?: Numeric
  sortOrder?: Numeric
  name?: TextRef
  cvName?: CharacterCvName
}


interface SkillSubDescription {
  name?: TextRef
  desc?: string
  conditionId?: string
}

interface SkillPatch {
  level?: Numeric
  iconId?: string
  blackboard?: BlackboardValue[]
  coolDown?: Numeric
  costValue?: Numeric
  subDescDataList?: SkillSubDescription[]
}

interface SkillPatchEntry {
  SkillPatchDataBundle?: SkillPatch[]
}

interface SkillGroup {
  skillGroupId?: string
  skillGroupType?: Numeric
  icon?: string
  name?: TextRef
  desc?: TextRef
  skillIdList?: string[]
  conditionName1?: TextRef
  conditionDesc1?: TextRef
  conditionPostDesc1?: TextRef
  conditionIcon1?: string
  conditionName2?: TextRef
  conditionDesc2?: TextRef
  conditionPostDesc2?: TextRef
  conditionIcon2?: string
  conditionId1?: string
  conditionId2?: string
}

interface RequiredItem {
  id?: string
  count?: Numeric
}

interface SkillLevelUp {
  skillGroupId?: string
  level?: Numeric
  goldCost?: Numeric
  itemBundle?: RequiredItem | RequiredItem[]
}

interface AttributeModifier {
  attrType?: Numeric
  attrValue?: Numeric
}

interface AttributeNodeInfo {
  breakStage?: Numeric
  favorability?: Numeric
  customIcon?: string
  title?: TextRef
  desc?: TextRef
  attributeModifiers?: AttributeModifier[]
}

interface FactorySkillNodeInfo {
  breakStage?: Numeric
  index?: Numeric
  level?: Numeric
}

interface PassiveSkillNodeInfo {
  index?: Numeric
  level?: Numeric
  breakStage?: Numeric
  talentEffectId?: string
  name?: TextRef
  iconId?: string
}
interface TalentNode {
  nodeType?: Numeric
  requiredItem?: RequiredItem[]
  attributeNodeInfo?: AttributeNodeInfo
  factorySkillNodeInfo?: FactorySkillNodeInfo
  passiveSkillNodeInfo?: PassiveSkillNodeInfo
}

interface CharacterBreakCost {
  nodeType?: Numeric
  breakStage?: Numeric
  requiredItem?: RequiredItem[]
}

interface CharacterGrowthEntry {
  skillGroupMap?: Record<string, SkillGroup>
  skillLevelUp?: SkillLevelUp[] | Record<string, SkillLevelUp[]>
  talentNodeMap?: Record<string, TalentNode>
  charBreakCostMap?: Record<string, CharacterBreakCost>
}

interface PotentialUnlock {
  level?: Numeric
  name?: TextRef
  potentialEffectId?: string
  itemIds?: string[]
  unlockCharPictureItemList?: string[]
}

interface CharacterPotentialEntry {
  firstItemId?: string
  potentialUnlockBundle?: PotentialUnlock[]
}

interface EffectDataItem {
  attachSkill?: { blackboard?: BlackboardValue[] }
  attachBuff?: { blackboard?: BlackboardValue[] }
  skillBbModifier?: { bbKey?: string; floatValue?: Numeric }
  attrModifier?: { attrType?: Numeric; attrValue?: Numeric }
  skillParamModifier?: { paramType?: Numeric; paramValue?: Numeric }
}

interface PotentialTalentEffect {
  name?: TextRef
  desc?: TextRef
  dataList?: EffectDataItem[]
}

interface SpaceshipCharacterSkill {
  skillId?: string
  skillIndex?: Numeric
  unlockHint?: TextRef
}

interface SpaceshipCharacterSkillEntry {
  skillList?: SpaceshipCharacterSkill[]
}

interface SpaceshipSkillEntry {
  icon?: string
  level?: Numeric
  talentName?: TextRef
  name?: TextRef
  desc?: TextRef
}

interface NamedEnumEntry {
  name?: TextRef
}

interface ItemEntry {
  name?: TextRef
  iconId?: string
  rarity?: Numeric
}

export interface CharacterWikiSource {
  attributeVariableNames?: Record<string, string>
  characterConst: { maxLevel?: Numeric }
  characterTable: Record<string, CharacterTableEntry>
  characterGrowthTable: Record<string, CharacterGrowthEntry>
  characterPotentialTable: Record<string, CharacterPotentialEntry>
  potentialTalentEffectTable: Record<string, PotentialTalentEffect>
  skillPatchTable: Record<string, SkillPatchEntry>
  spaceshipCharacterSkillTable: Record<string, SpaceshipCharacterSkillEntry>
  spaceshipSkillTable: Record<string, SpaceshipSkillEntry>
  characterTypeTable: Record<string, NamedEnumEntry>
  characterProfessionTable: Record<string, NamedEnumEntry>
  itemTable: Record<string, ItemEntry>
  textTables: Record<string, Record<string, string>>
}

export interface CharacterWikiData {
  summaries: WikiCharacterSummary[]
  details: WikiCharacterDetailMap
  enumLabels: WikiEnumLabels
}


function collectEffectValues(
  effect: PotentialTalentEffect | undefined,
  attributeVariableNames: Readonly<Record<string, string>> = {}
): Record<string, number> {
  const values: Record<string, number> = {}
  for (const item of effect?.dataList ?? []) {
    Object.assign(values, collectBlackboard(item.attachSkill?.blackboard))
    Object.assign(values, collectBlackboard(item.attachBuff?.blackboard))
    if (item.skillBbModifier?.bbKey && item.skillBbModifier.floatValue !== undefined) {
      values[item.skillBbModifier.bbKey] = numberValue(item.skillBbModifier.floatValue)
    }
    if (item.attrModifier?.attrType !== undefined && item.attrModifier.attrValue !== undefined) {
      const attributeId = String(item.attrModifier.attrType)
      const value = numberValue(item.attrModifier.attrValue)
      values[attributeId] = value
      const variableName = attributeVariableNames[attributeId]
      if (variableName) values[variableName] = value
    }
    if (item.skillParamModifier?.paramType !== undefined && item.skillParamModifier.paramValue !== undefined) {
      const variableName = SKILL_PARAMETER_NAMES[numberValue(item.skillParamModifier.paramType)]
      if (variableName) values[variableName] = numberValue(item.skillParamModifier.paramValue)
    }
  }
  return values
}

function buildLevels(entry: CharacterTableEntry, maxLevel: number): WikiCharacterLevel[] {
  const byLevel = new Map<number, { row: CharacterAttributeRow; duplicate: boolean }>()
  for (const row of entry.attributes ?? []) {
    const levelEntry = row.Attribute?.attrs?.find((attribute) => numberValue(attribute.attrType) === 0)
    const level = levelEntry ? numberValue(levelEntry.attrValue) : 0
    if (level < 1 || level > maxLevel) continue
    const previous = byLevel.get(level)
    const nextStage = numberValue(row.breakStage)
    const previousStage = previous ? numberValue(previous.row.breakStage, -1) : -1
    if (!previous || nextStage >= previousStage) {
      byLevel.set(level, { row, duplicate: Boolean(previous) || previous?.duplicate === true })
    } else if (previous) {
      previous.duplicate = true
    }
  }

  return [...byLevel]
    .sort(([left], [right]) => left - right)
    .map(([level, { row, duplicate }]) => ({
      level,
      breakStage: numberValue(row.breakStage),
      isBreakthrough: duplicate,
      stats: (row.Attribute?.attrs ?? [])
        .filter((attribute) => numberValue(attribute.attrType) !== 0)
        .map((attribute) => ({
          attributeId: String(attribute.attrType),
          value: Math.round(numberValue(attribute.attrValue) * 100_000) / 100_000,
        })),
    }))
}

function requiredItems(value: RequiredItem | RequiredItem[] | undefined): RequiredItem[] {
  return Array.isArray(value) ? value : value ? [value] : []
}

function skillLevelUps(growth: CharacterGrowthEntry | undefined, groupId: string): SkillLevelUp[] {
  const source = growth?.skillLevelUp
  if (!source) return []
  if (Array.isArray(source)) return source.filter((entry) => !entry.skillGroupId || entry.skillGroupId === groupId)
  return source[groupId] ?? Object.values(source).flat().filter((entry) => entry.skillGroupId === groupId)
}

function buildSkillLevels(
  patchSources: Array<{ skillId: string; list: SkillPatch[] }>,
  costs: Map<number, SkillLevelUp>,
  itemTable: CharacterWikiSource['itemTable'],
  textTables: CharacterWikiSource['textTables']
) {
  const levelCount = Math.max(1, ...patchSources.map((source) => source.list.length))
  return Array.from({ length: levelCount }, (_, levelIndex) => {
    const patchesAtLevel = patchSources.map(({ list }) => list[levelIndex] ?? list.at(-1))
    const level = numberValue(patchesAtLevel[0]?.level, levelIndex + 1)
    const cost = costs.get(level)
    const coolDown = patchesAtLevel.find((patch) => numberValue(patch?.coolDown) > 0)?.coolDown
    const costValue = patchesAtLevel.find((patch) => numberValue(patch?.costValue) > 0)?.costValue
    const materials = cost
      ? [
        ...requiredItems(cost.itemBundle),
        ...(numberValue(cost.goldCost) > 0 ? [{ id: 'item_gold', count: cost.goldCost }] : []),
      ]
        .map((required) => material(required, itemTable, textTables))
        .filter((value): value is WikiMaterial => value !== null)
      : []
    return {
      level,
      label: level <= 9 ? `Lv.${level}` : `M${level - 9}`,
      values: patchesAtLevel.flatMap((patch) =>
        (patch?.subDescDataList ?? []).map((metric) => metric.desc ?? '')
      ),
      ...(coolDown === undefined ? {} : { coolDown: numberValue(coolDown) }),
      ...(costValue === undefined ? {} : { costValue: numberValue(costValue) }),
      ...(materials.length > 0 ? { materials } : {}),
    }
  })
}

function buildSkillMetrics(
  patchSources: Array<{ skillId: string; list: SkillPatch[] }>,
  textTables: CharacterWikiSource['textTables']
): WikiCharacterSkill['metrics'] {
  return patchSources.flatMap(({ skillId, list }) =>
    (list[0]?.subDescDataList ?? []).map((metric, metricIndex) => ({
      id: `${skillId}:${metricIndex}`,
      label: localize(metric.name, textTables),
    }))
  )
}
function skillPatchSourceSignature(
  source: { skillId: string; list: SkillPatch[] },
  textTables: CharacterWikiSource['textTables']
): string {
  return JSON.stringify(source.list.map((patch) => ({
    level: numberValue(patch.level),
    iconId: patch.iconId ?? '',
    coolDown: patch.coolDown === undefined ? null : numberValue(patch.coolDown),
    costValue: patch.costValue === undefined ? null : numberValue(patch.costValue),
    metrics: (patch.subDescDataList ?? []).map((metric) => ({
      label: localize(metric.name, textTables),
      value: metric.desc ?? '',
    })),
  })))
}
function buildVariantPatchSources(
  patchSources: Array<{ skillId: string; list: SkillPatch[] }>,
  conditionId: string | undefined,
  iconId: string | undefined
): Array<{ skillId: string; list: SkillPatch[] }> {
  const iconMatches = iconId
    ? patchSources.filter((source) => source.list.some((patch) => patch.iconId === iconId))
    : []
  const selected = iconMatches.length > 0 ? iconMatches : patchSources
  return selected.map((source) => ({
    skillId: source.skillId,
    list: source.list.map((patch) => ({
      ...patch,
      subDescDataList: (patch.subDescDataList ?? []).filter((metric) =>
        !metric.conditionId || !conditionId || metric.conditionId === conditionId
      ),
    })),
  }))
}


function cleanSkillCondition(value: string): string {
  return value
    .replace(/^\/\*|\*\/$/g, '')
    .replace(/[（(]\s*<@ba\.vup>\{floor:deck_(?:wisd|will):0\}<\/>\s*[)）]/g, '')
    .trim()
}

function localizeSkillCondition(
  ref: TextRef | undefined,
  textTables: CharacterWikiSource['textTables']
): LocalizedText {
  const value = localize(ref, textTables)
  return Object.fromEntries(
    Object.entries(value).map(([locale, text]) => [locale, cleanSkillCondition(text)])
  ) as LocalizedText
}

function buildSkills(
  growth: CharacterGrowthEntry | undefined,
  patches: CharacterWikiSource['skillPatchTable'],
  itemTable: CharacterWikiSource['itemTable'],
  textTables: CharacterWikiSource['textTables']
): WikiCharacterSkill[] {
  return Object.values(growth?.skillGroupMap ?? {})
    .sort((left, right) => numberValue(left.skillGroupType) - numberValue(right.skillGroupType))
    .map((group, index) => {
      const seenPatchSources = new Set<string>()
      const patchSources = (group.skillIdList ?? [])
        .map((skillId) => ({ skillId, list: patches[skillId]?.SkillPatchDataBundle ?? [] }))
        .filter((source) => source.list.length > 0)
        .filter((source) => {
          const signature = skillPatchSourceSignature(source, textTables)
          if (seenPatchSources.has(signature)) return false
          seenPatchSources.add(signature)
          return true
        })
      const groupId = group.skillGroupId ?? group.skillIdList?.[0] ?? `skill-${index}`
      const costs = new Map(skillLevelUps(growth, groupId).map((cost) => [numberValue(cost.level), cost]))
      const metrics = buildSkillMetrics(patchSources, textTables)
      const levels = buildSkillLevels(patchSources, costs, itemTable, textTables)
      const descriptionValues: Record<string, number> = {}
      for (const { list } of patchSources) {
        Object.assign(descriptionValues, collectBlackboard(list.at(-1)?.blackboard))
      }
      const sourceIcon = patchSources
        .map((source) => source.list[0]?.iconId ?? '')
        .find((iconId) => iconId.startsWith('icon_')) ?? ''
      const variantSources = [
        {
          index: 1,
          name: group.conditionName1,
          condition: group.conditionDesc1,
          conditionId: group.conditionId1,
          description: group.conditionPostDesc1,
          iconId: group.conditionIcon1,
        },
        {
          index: 2,
          name: group.conditionName2,
          condition: group.conditionDesc2,
          conditionId: group.conditionId2,
          description: group.conditionPostDesc2,
          iconId: group.conditionIcon2,
        },
      ]
      const variants = variantSources.flatMap((variant): WikiCharacterSkillVariant[] => {
        const name = localize(variant.name, textTables)
        if (!name['zh-CN'] || name['zh-CN'] === '0') return []
        const formPatchSources = buildVariantPatchSources(patchSources, variant.conditionId, variant.iconId)
        const formDescriptionValues: Record<string, number> = {}
        for (const { list } of formPatchSources) {
          Object.assign(formDescriptionValues, collectBlackboard(list.at(-1)?.blackboard))
        }
        return [{
          id: `${groupId}:form-${variant.index}`,
          name,
          condition: localizeSkillCondition(variant.condition, textTables),
          description: localizeDescription(variant.description, textTables, formDescriptionValues),
          iconId: variant.iconId || group.icon || sourceIcon,
          metrics: buildSkillMetrics(formPatchSources, textTables),
          levels: buildSkillLevels(formPatchSources, costs, itemTable, textTables),
        }]
      })
      return {
        id: groupId,
        typeId: String(group.skillGroupType ?? 0),
        name: localize(group.name, textTables),
        description: localizeDescription(group.desc, textTables, descriptionValues),
        iconId: group.icon || sourceIcon,
        metrics,
        levels,
        ...(variants.length > 0 ? { variants } : {}),
      }
    })
}

function buildTalents(
  growth: CharacterGrowthEntry | undefined,
  effects: CharacterWikiSource['potentialTalentEffectTable'],
  itemTable: CharacterWikiSource['itemTable'],
  textTables: CharacterWikiSource['textTables'],
  attributeVariableNames: Readonly<Record<string, string>>
): WikiCharacterTalent[] {
  return Object.values(growth?.talentNodeMap ?? {})
    .filter((node) => numberValue(node.nodeType) === 4 && node.passiveSkillNodeInfo?.talentEffectId)
    .sort((left, right) => {
      const leftInfo = left.passiveSkillNodeInfo
      const rightInfo = right.passiveSkillNodeInfo
      return numberValue(leftInfo?.index) - numberValue(rightInfo?.index) ||
        numberValue(leftInfo?.level) - numberValue(rightInfo?.level)
    })
    .map((node) => {
      const info = node.passiveSkillNodeInfo
      const effectId = info?.talentEffectId ?? ''
      const effect = effects[effectId]
      return {
        id: effectId,
        name: localize(info?.name ?? effect?.name, textTables),
        description: localizeDescription(effect?.desc, textTables, collectEffectValues(effect, attributeVariableNames)),
        iconId: info?.iconId,
        breakStage: numberValue(info?.breakStage),
        materials: requiredItems(node.requiredItem)
          .map((required) => material(required, itemTable, textTables))
          .filter((value): value is WikiMaterial => value !== null),
      }
    })
}

function buildAttributeNodes(
  growth: CharacterGrowthEntry | undefined,
  itemTable: CharacterWikiSource['itemTable'],
  textTables: CharacterWikiSource['textTables'],
  attributeVariableNames: Readonly<Record<string, string>>
): WikiCharacterAttributeNode[] {
  return Object.entries(growth?.talentNodeMap ?? {})
    .filter(([, node]) => numberValue(node.nodeType) === 3 && node.attributeNodeInfo)
    .map(([id, node]) => {
      const info = node.attributeNodeInfo
      const values: Record<string, number> = {}
      const stats = (info?.attributeModifiers ?? []).map((modifier) => {
        const attributeId = String(modifier.attrType ?? '')
        const value = numberValue(modifier.attrValue)
        values[attributeId] = value
        const variableName = attributeVariableNames[attributeId]
        if (variableName) values[variableName] = value
        return { attributeId, value }
      })
      return {
        id,
        title: localize(info?.title, textTables),
        description: localizeDescription(info?.desc, textTables, values),
        iconId: info?.customIcon || undefined,
        breakStage: numberValue(info?.breakStage),
        favorability: numberValue(info?.favorability),
        stats,
        materials: requiredItems(node.requiredItem)
          .map((required) => material(required, itemTable, textTables))
          .filter((value): value is WikiMaterial => value !== null),
      }
    })
    .sort((left, right) => left.breakStage - right.breakStage || left.id.localeCompare(right.id))
}

function buildLogisticsNodes(
  growth: CharacterGrowthEntry | undefined,
  itemTable: CharacterWikiSource['itemTable'],
  textTables: CharacterWikiSource['textTables']
): WikiCharacterLogisticsNode[] {
  return Object.entries(growth?.talentNodeMap ?? {})
    .filter(([, node]) => numberValue(node.nodeType) === 5 && node.factorySkillNodeInfo)
    .map(([id, node]) => ({
      id,
      breakStage: numberValue(node.factorySkillNodeInfo?.breakStage),
      index: numberValue(node.factorySkillNodeInfo?.index),
      level: numberValue(node.factorySkillNodeInfo?.level),
      materials: requiredItems(node.requiredItem)
        .map((required) => material(required, itemTable, textTables))
        .filter((value): value is WikiMaterial => value !== null),
    }))
    .sort((left, right) => left.breakStage - right.breakStage || left.index - right.index || left.level - right.level)
}

function buildPotentials(
  potentials: CharacterPotentialEntry | undefined,
  effects: CharacterWikiSource['potentialTalentEffectTable'],
  textTables: CharacterWikiSource['textTables'],
  attributeVariableNames: Readonly<Record<string, string>>
) {
  return (potentials?.potentialUnlockBundle ?? []).map((potential, index) => {
    const effectId = potential.potentialEffectId ?? `potential-${index + 1}`
    const effect = effects[effectId]
    return {
      id: effectId,
      level: numberValue(potential.level, index + 1),
      name: localize(potential.name ?? effect?.name, textTables),
      description: localizeDescription(effect?.desc, textTables, collectEffectValues(effect, attributeVariableNames)),
      imageIds: potential.unlockCharPictureItemList ?? [],
    }
  })
}

function buildLogisticsSkills(
  character: SpaceshipCharacterSkillEntry | undefined,
  skills: CharacterWikiSource['spaceshipSkillTable'],
  textTables: CharacterWikiSource['textTables']
): WikiCharacterLogisticsSkill[] {
  return (character?.skillList ?? []).flatMap((reference) => {
    const id = reference.skillId
    const skill = id ? skills[id] : undefined
    if (!id || !skill) return []
    return [{
      id,
      name: localize(skill.name ?? skill.talentName, textTables),
      description: localize(skill.desc, textTables),
      iconId: skill.icon,
      unlockHint: localize(reference.unlockHint, textTables),
      index: numberValue(reference.skillIndex),
      level: numberValue(skill.level, 1),
    }]
  })
}

function buildCvNames(
  cvName: CharacterCvName | undefined,
  textTables: CharacterWikiSource['textTables']
): WikiCharacterVoiceName[] {
  const rows = [
    { language: 'zh-CN', ref: cvName?.ChiCVName },
    { language: 'en', ref: cvName?.EngCVName },
    { language: 'ja', ref: cvName?.JapCVName },
    { language: 'ko', ref: cvName?.KorCVName },
  ] as const
  return rows.flatMap(({ language, ref }) => {
    const id = ref?.id === undefined ? '' : String(ref.id)
    if (!id || id === '0') return []
    return [{
      language,
      original: textTables[language]?.[id] ?? '',
      localized: localize(ref, textTables),
    }]
  })
}

function material(
  required: RequiredItem,
  itemTable: CharacterWikiSource['itemTable'],
  textTables: CharacterWikiSource['textTables']
): WikiMaterial | null {
  const itemId = required.id
  if (!itemId) return null
  const item = itemTable[itemId]
  return {
    itemId,
    name: localize(item?.name, textTables),
    iconId: item?.iconId ?? itemId,
    rarity: numberValue(item?.rarity, 1),
    count: numberValue(required.count),
  }
}

function buildPromotions(
  growth: CharacterGrowthEntry | undefined,
  itemTable: CharacterWikiSource['itemTable'],
  textTables: CharacterWikiSource['textTables']
): WikiCharacterPromotion[] {
  return Object.entries(growth?.charBreakCostMap ?? {})
    .filter(([, cost]) => numberValue(cost.nodeType) === 1)
    .map(([nodeId, cost]) => ({
      breakStage: numberValue(cost.breakStage),
      requiredLevel: Number(nodeId.match(/(\d+)/)?.[1] ?? 0),
      materials: (cost.requiredItem ?? [])
        .map((required) => material(required, itemTable, textTables))
        .filter((value): value is WikiMaterial => value !== null),
    }))
    .sort((left, right) => left.breakStage - right.breakStage)
}

function buildEnumLabels(source: CharacterWikiSource): WikiEnumLabels {
  const empty = (): Record<string, LocalizedText> => ({})
  const result: WikiEnumLabels = {
    attributes: empty(),
    elements: empty(),
    professions: empty(),
    factions: empty(),
    weaponTypes: empty(),
    equipmentParts: empty(),
    skillTypes: empty(),
  }
  for (const [id, value] of Object.entries(source.characterTypeTable)) {
    result.elements[id] = localize(value.name, source.textTables)
  }
  for (const [id, value] of Object.entries(source.characterProfessionTable)) {
    result.professions[id] = localize(value.name, source.textTables)
  }
  return result
}

export function buildCharacterWikiData(source: CharacterWikiSource): CharacterWikiData {
  const maxLevel = numberValue(source.characterConst.maxLevel, 90)
  const summaries: WikiCharacterSummary[] = []
  const details: WikiCharacterDetailMap = {}

  for (const [id, character] of Object.entries(source.characterTable)) {
    if (!id.startsWith('chr_') || DEPRECATED_CHARACTER_IDS[id]) continue
    const item = source.itemTable[id]
    const summary: WikiCharacterSummary = {
      id,
      category: 'characters',
      name: localize(item?.name ?? character.name, source.textTables),
      rarity: numberValue(character.rarity ?? item?.rarity),
      imageId: id,
      elementId: character.charTypeId ?? '',
      professionId: String(character.profession ?? ''),
      factionId: character.department ?? '',
      weaponTypeId: String(character.weaponType ?? ''),
      mainAttributeId: String(character.mainAttrType ?? ''),
      subAttributeId: String(character.subAttrType ?? ''),
    }
    summaries.push(summary)

    const growth = source.characterGrowthTable[id]
    const images = id === ADMINISTRATOR_ID
      ? {
          defaultAvatarId: ADMINISTRATOR_ID,
          fullBodyIds: {
            default: `${ADMINISTRATOR_ID}-female`,
            female: `${ADMINISTRATOR_ID}-female`,
            male: `${ADMINISTRATOR_ID}-male`,
          },
        }
      : { defaultAvatarId: id, fullBodyIds: { default: id } }
    const detail: WikiCharacterDetail = {
      id,
      category: 'characters',
      maxLevel,
      levels: buildLevels(character, maxLevel),
      skills: buildSkills(growth, source.skillPatchTable, source.itemTable, source.textTables),
      talents: buildTalents(
        growth,
        source.potentialTalentEffectTable,
        source.itemTable,
        source.textTables,
        source.attributeVariableNames ?? {}
      ),
      attributeNodes: buildAttributeNodes(
        growth,
        source.itemTable,
        source.textTables,
        source.attributeVariableNames ?? {}
      ),
      logisticsNodes: buildLogisticsNodes(growth, source.itemTable, source.textTables),
      potentials: buildPotentials(
        source.characterPotentialTable[id],
        source.potentialTalentEffectTable,
        source.textTables,
        source.attributeVariableNames ?? {}
      ),
      logisticsSkills: buildLogisticsSkills(
        source.spaceshipCharacterSkillTable[id],
        source.spaceshipSkillTable,
        source.textTables
      ),
      cvNames: buildCvNames(character.cvName, source.textTables),
      promotions: buildPromotions(growth, source.itemTable, source.textTables),
      images,
    }
    details[id] = detail
  }

  summaries.sort((left, right) => {
    const leftOrder = numberValue(source.characterTable[left.id]?.sortOrder, Number.MAX_SAFE_INTEGER)
    const rightOrder = numberValue(source.characterTable[right.id]?.sortOrder, Number.MAX_SAFE_INTEGER)
    return leftOrder - rightOrder || left.id.localeCompare(right.id)
  })

  return { summaries, details, enumLabels: buildEnumLabels(source) }
}
