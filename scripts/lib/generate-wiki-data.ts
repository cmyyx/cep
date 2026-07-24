import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  LocalizedText,
  WikiEntitySummary,
  WikiEnumLabels,
  WikiEquipmentPlannerPreview,
  WikiRichTextTerm,
  WikiWeaponPlannerPreview,
} from '../../src/types/wiki'
import type { CharacterWikiData } from './build-character-wiki'
import { buildItemWikiData, type ItemWikiData, type ItemWikiSource } from './build-item-wiki'
import { buildAttrShowConfigs } from './equip-stat-format'
import { parseJsonSafe } from './json-utils'
import { loadAllTextTables, SUPPORTED_LOCALES } from './stat-mapping'
import { localizeWikiText, type TextRef, type WikiTextTables } from './wiki-builder-utils'
import { weapons } from '../../src/data/weapons'
import { equips } from '../../src/data/equips'
import { collectWikiAssets, type WikiAssets } from './wiki-assets'
import { buildPlannerGameData, writePlannerGameData } from './generate-planner-data'
import { wikiTextKey } from '../../src/lib/wiki-i18n'
import type { PlannerGameData } from '../../src/types/planner'

interface AttributeShowEntry {
  list?: Array<{ name?: TextRef }>
}
interface HyperlinkTextEntry {
  name?: TextRef
  desc?: TextRef
  richTextId?: string
}

export function buildWikiGlossary(
  entries: Record<string, HyperlinkTextEntry>,
  textTables: WikiTextTables
): Record<string, WikiRichTextTerm> {
  return Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, {
    name: localizeWikiText(entry.name, textTables),
    description: localizeWikiText(entry.desc, textTables),
    styleId: entry.richTextId ?? '',
  }]))
}

interface GameTextEntry {
  id?: string | number
}

const GAME_UI_TEXT_KEYS = {
  operatorLevel: 'LUA_ACTIVITY_CULTIVATION_REFUND_SERIES_1',
  equipmentAdaptation: 'ui_char_info_talent_equip_suit',
  talent: 'ui_char_info_talent_char_talent',
  attributeIncrease: 'ui_char_info_talent_attr_enhanced',
  logisticsSkill: 'ui_char_info_talent_fac_skill',
  promotion: 'ui_char_info_talent_eliterize',
  normalAttack: 'LUA_CHAR_INFO_NORMAL_ATTACK_NAME',
  battleSkill: 'LUA_CHAR_INFO_NORMAL_SKILL_NAME',
  ultimate: 'LUA_CHAR_INFO_ULTIMATE_SKILL_NAME',
  comboSkill: 'LUA_CHAR_INFO_COMBO_SKILL_NAME',
  /** Character skill panel title (干员技能). */
  operatorSkill: 'ui_char_info_talent_skill_name',
  /** Combat skill list heading (战斗技能). */
  battleSkills: 'ui_char_info_talent_skill_list',
  potential: 'ui_char_info_potential_pot',
  potentialLevel: 'LUA_POTENTIAL_LEVEL',
  mainAttribute: 'ui_char_info_full_attribute_main_attr',
  subAttribute: 'ui_char_info_full_attribute_sub_attr',
  friendship: 'ui_char_info_controller_friendship',
  abilityMatrix: 'ui_char_info_talent_title',
} as const

export type WikiI18nCatalogs = Record<keyof LocalizedText, Record<string, string>>

export function buildWikiI18nCatalogs(
  characters: CharacterWikiData,
  items: ItemWikiData,
  enums: WikiEnumLabels,
  glossary: Record<string, WikiRichTextTerm>,
  planner: PlannerGameData,
  gameTextTable: Record<string, GameTextEntry>,
  textTables: WikiTextTables
): WikiI18nCatalogs {
  const catalogs = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, {}])
  ) as WikiI18nCatalogs
  const add = (key: string, value: LocalizedText) => {
    for (const locale of SUPPORTED_LOCALES) {
      catalogs[locale][key] = value[locale] || value['zh-CN'] || key
    }
  }
  const addRef = (key: string, ref: TextRef | undefined) => add(key, localizeWikiText(ref, textTables))

  for (const [group, values] of Object.entries(enums)) {
    for (const [id, value] of Object.entries(values)) add(wikiTextKey('enum', group, id), value)
  }
  for (const [semanticKey, sourceKey] of Object.entries(GAME_UI_TEXT_KEYS)) {
    addRef(wikiTextKey('ui', semanticKey), gameTextTable[sourceKey])
  }
  for (const detail of Object.values(characters.details)) {
    for (const skill of detail.skills) {
      const prefix = ['character', detail.id, 'skill', skill.id] as const
      add(wikiTextKey(...prefix, 'name'), skill.name)
      add(wikiTextKey(...prefix, 'description'), skill.description)
      for (const metric of skill.metrics) add(wikiTextKey(...prefix, 'metric', metric.id), metric.label)
      for (const variant of skill.variants ?? []) {
        const variantPrefix = ['character', detail.id, 'variant', variant.id] as const
        add(wikiTextKey(...variantPrefix, 'name'), variant.name)
        add(wikiTextKey(...variantPrefix, 'condition'), variant.condition)
        add(wikiTextKey(...variantPrefix, 'description'), variant.description)
        for (const metric of variant.metrics) add(wikiTextKey(...variantPrefix, 'metric', metric.id), metric.label)
      }
    }
    for (const talent of detail.talents) {
      add(wikiTextKey('character', detail.id, 'talent', talent.id, 'name'), talent.name)
      add(wikiTextKey('character', detail.id, 'talent', talent.id, 'description'), talent.description)
    }
    for (const node of detail.attributeNodes) {
      add(wikiTextKey('character', detail.id, 'attribute', node.id, 'name'), node.title)
      add(wikiTextKey('character', detail.id, 'attribute', node.id, 'description'), node.description)
    }
    for (const node of detail.equipmentNodes) {
      add(wikiTextKey('character', detail.id, 'equipment', node.id, 'name'), node.name)
      add(wikiTextKey('character', detail.id, 'equipment', node.id, 'description'), node.description)
    }
    for (const potential of detail.potentials) {
      add(wikiTextKey('character', detail.id, 'potential', potential.id, 'name'), potential.name)
      add(wikiTextKey('character', detail.id, 'potential', potential.id, 'description'), potential.description)
    }
    for (const skill of detail.logisticsSkills) {
      add(wikiTextKey('character', detail.id, 'logistics', skill.id, 'name'), skill.name)
      add(wikiTextKey('character', detail.id, 'logistics', skill.id, 'description'), skill.description)
      add(wikiTextKey('character', detail.id, 'logistics', skill.id, 'unlockHint'), skill.unlockHint)
    }
  }
  for (const detail of Object.values(items.weaponDetails)) {
    for (const skill of detail.skills) {
      add(wikiTextKey('weapon', detail.id, 'skill', skill.id, 'name'), skill.name)
      add(wikiTextKey('weapon', detail.id, 'skill', skill.id, 'description'), skill.description)
      for (const level of skill.levels) add(wikiTextKey('weapon', detail.id, 'skill', skill.id, 'level', level.level), level.description)
    }
  }
  for (const equipment of items.equipmentSummaries) {
    if (equipment.suitId && equipment.suitName) add(wikiTextKey('suit', equipment.suitId), equipment.suitName)
  }
  for (const detail of Object.values(items.equipmentDetails)) {
    for (const effect of detail.suitEffects) {
      add(wikiTextKey('equipment', detail.id, 'effect', effect.id, 'name'), effect.name)
      add(wikiTextKey('equipment', detail.id, 'effect', effect.id, 'description'), effect.description)
    }
  }
  for (const [id, term] of Object.entries(glossary)) {
    add(wikiTextKey('glossary', id, 'name'), term.name)
    add(wikiTextKey('glossary', id, 'description'), term.description)
  }
  for (const [itemId, material] of Object.entries(planner.materials)) add(wikiTextKey('item', itemId), material.name)
  for (const dungeon of planner.dungeons) {
    add(wikiTextKey('dungeon', dungeon.id), dungeon.name)
    add(wikiTextKey('dungeon', dungeon.seriesId), dungeon.seriesName)
  }
  for (const [characterId, character] of Object.entries(planner.characters)) {
    for (const node of [...character.talents, ...character.attributeNodes, ...character.equipmentNodes, ...character.logisticsNodes]) {
      add(wikiTextKey('character', characterId, 'plannerNode', node.id, 'name'), node.name)
    }
  }
  return catalogs
}

function writeWikiI18nFiles(outputDir: string, catalogs: WikiI18nCatalogs): string[] {
  const dir = join(outputDir, 'wikiData')
  mkdirSync(dir, { recursive: true })
  return SUPPORTED_LOCALES.map((locale) => {
    const path = join(dir, `${locale}.json`)
    writeFileSync(path, `${JSON.stringify(catalogs[locale], null, 2)}\n`, 'utf8')
    return path
  })
}
type AttributeMapLabels = Record<keyof LocalizedText, Record<string, string>>

export function mergeAttributeMapLabels(maps: AttributeMapLabels): Record<string, LocalizedText> {
  const ids = new Set(Object.values(maps).flatMap((map) => Object.keys(map)))
  return Object.fromEntries([...ids].sort((left, right) => Number(left) - Number(right)).map((id) => [id, {
    'zh-CN': maps['zh-CN'][id] ?? id,
    en: maps.en[id] ?? maps['zh-CN'][id] ?? id,
    ja: maps.ja[id] ?? maps['zh-CN'][id] ?? id,
    'zh-TW': maps['zh-TW'][id] ?? maps['zh-CN'][id] ?? id,
  }]))
}

function equipmentStatValue(value: string | number): string {
  const text = String(value)
  return text.includes('+') ? text.slice(text.indexOf('+') + 1) : text
}

export function buildPlannerWikiPreviews(
  itemData: ItemWikiData,
  weaponIds: ReadonlySet<string>,
  equipmentIds: ReadonlySet<string>
): {
  weapons: Record<string, WikiWeaponPlannerPreview>
  equipment: Record<string, WikiEquipmentPlannerPreview>
} {
  const weaponPreviews = Object.fromEntries(
    Object.entries(itemData.weaponDetails)
      .filter(([id]) => weaponIds.has(id))
      .map(([id, detail]) => [id, {
        stats: detail.skills.slice(0, 3).map((skill) => ({
          levelOne: skill.levels[0]?.description ?? skill.description,
          maxLevel: skill.levels.at(-1)?.description ?? skill.description,
          levelOneLabel: `Lv.${skill.levels[0]?.level ?? 1}`,
          maxLevelLabel: `Lv.${skill.levels.at(-1)?.level ?? 1}`,
        })),
      }])
  )
  const equipmentPreviews = Object.fromEntries(
    Object.entries(itemData.equipmentDetails)
      .filter(([id]) => equipmentIds.has(id))
      .map(([id, detail]) => [id, {
        stats: detail.stats.map((stat) => {
          const values = stat.displayValues ?? stat.values
          return {
            attributeId: stat.attributeId,
            levelOne: equipmentStatValue(values[0] ?? '—'),
            maxLevel: equipmentStatValue(values.at(-1) ?? '—'),
            levelOneLabel: '+0',
            maxLevelLabel: `+${Math.max(0, values.length - 1)}`,
          }
        }),
        craftingRecipes: detail.craftingRecipes,
      }])
  )
  return { weapons: weaponPreviews, equipment: equipmentPreviews }
}

function writePlannerPreviewFile(dataDir: string, itemData: ItemWikiData): string {
  const path = join(dataDir, 'wiki', 'planner-previews.ts')
  const previews = buildPlannerWikiPreviews(
    itemData,
    new Set(weapons.map((weapon) => weapon.id)),
    new Set(equips.map((equipment) => equipment.id))
  )
  writeFileSync(path, [
    '// Auto-generated by generate-wiki-data.ts during sync-game-data.',
    '// DO NOT EDIT MANUALLY.',
    "import type { WikiEquipmentPlannerPreview, WikiWeaponPlannerPreview } from '@/types/wiki'",
    '',
    `export const wikiWeaponPlannerPreviews: Record<string, WikiWeaponPlannerPreview> = ${JSON.stringify(previews.weapons, null, 2)}`,
    '',
    `export const wikiEquipmentPlannerPreviews: Record<string, WikiEquipmentPlannerPreview> = ${JSON.stringify(previews.equipment, null, 2)}`,
    '',
  ].join('\n'), 'utf8')
  return path
}

function loadAttributeMapLabels(imagedbPath: string): Record<string, LocalizedText> {
  const directories: Record<keyof LocalizedText, string> = {
    'zh-CN': 'CH',
    en: 'EN',
    ja: 'JP',
    'zh-TW': 'TC',
  }
  const maps = Object.fromEntries(Object.entries(directories).map(([locale, directory]) => {
    const path = join(imagedbPath, 'public', directory, 'maps.json')
    const data = JSON.parse(readFileSync(path, 'utf8')) as { ATTR_MAP: Record<string, string> }
    return [locale, data.ATTR_MAP]
  })) as AttributeMapLabels
  return mergeAttributeMapLabels(maps)
}


function loadTable(akedataPath: string, table: string): unknown {
  return parseJsonSafe(join(akedataPath, 'TableCfg', `${table}.json`))
}

function writeSummaryFile(
  dataDir: string,
  category: 'weapons' | 'equipment',
  entries: WikiEntitySummary[]
): string {
  const dir = join(dataDir, 'wiki')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${category}.ts`)
  const typeName = category === 'weapons' ? 'WikiWeaponSummary' : 'WikiEquipmentSummary'
  const exportName = category === 'weapons' ? 'wikiWeapons' : 'wikiEquipment'
  writeFileSync(
    path,
    [
      '// Auto-generated by generate-wiki-data.ts during sync-game-data.',
      '// DO NOT EDIT MANUALLY.',
      `import type { ${typeName} } from '@/types/wiki'`,
      '',
      `export const ${exportName} = ${JSON.stringify(entries, null, 2)} satisfies ${typeName}[]`,
      '',
    ].join('\n'),
    'utf8'
  )
  return path
}

function writeDetailFiles(
  dataDir: string,
  category: 'weapons' | 'equipment',
  details: Record<string, unknown>
): string[] {
  const dir = join(dataDir, 'wiki', category)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return Object.entries(details).map(([id, detail]) => {
    const path = join(dir, `${id}.json`)
    writeFileSync(path, `${JSON.stringify(detail, null, 2)}\n`, 'utf8')
    return path
  })
}


function buildEnums(
  akedataPath: string,
  imagedbPath: string,
  dataOutputDir: string,
  textTables: WikiTextTables,
  gameTextTable: Record<string, GameTextEntry>
): { path: string; enums: WikiEnumLabels } {
  const characterEnumPath = join(dataOutputDir, 'wiki', 'character-enums.json')
  const characterEnums = JSON.parse(readFileSync(characterEnumPath, 'utf8')) as WikiEnumLabels
  const fromGameText = (key: string) => localizeWikiText(gameTextTable[key], textTables)
  const enums: WikiEnumLabels = {
    ...characterEnums,
    attributes: loadAttributeMapLabels(imagedbPath),
    weaponTypes: {
      '1': fromGameText('LUA_WEAPON_TYPE_1'),
      '2': fromGameText('LUA_WEAPON_TYPE_2'),
      '3': fromGameText('LUA_WEAPON_TYPE_3'),
      '5': fromGameText('LUA_WEAPON_TYPE_5'),
      '6': fromGameText('LUA_WEAPON_TYPE_6'),
    },
    equipmentParts: {
      '0': fromGameText('LUA_WIKI_FILTER_NAME_EQUIP_PART_BODY'),
      '1': fromGameText('LUA_WIKI_FILTER_NAME_EQUIP_PART_HAND'),
      '2': fromGameText('LUA_WIKI_FILTER_NAME_EQUIP_PART_EDC'),
    },
    skillTypes: {
      '0': fromGameText('LUA_CHAR_INFO_NORMAL_ATTACK_NAME'),
      '1': fromGameText('LUA_CHAR_INFO_NORMAL_SKILL_NAME'),
      '2': fromGameText('LUA_CHAR_INFO_ULTIMATE_SKILL_NAME'),
      '3': fromGameText('LUA_CHAR_INFO_COMBO_SKILL_NAME'),
    },
  }
  const attributeTable = loadTable(
    akedataPath,
    'AttributeShowConfigTable'
  ) as Record<string, AttributeShowEntry>
  for (const [id, entry] of Object.entries(attributeTable)) {
    const ref = entry.list?.[0]?.name
    if (ref) enums.attributes[id] = localizeWikiText(ref, textTables)
  }

  const path = join(dataOutputDir, 'wiki', 'enums.json')
  writeFileSync(path, `${JSON.stringify(enums, null, 2)}\n`, 'utf8')
  return { path, enums }
}

function writeEquipmentNameFiles(
  outputDir: string,
  summaries: ItemWikiData['equipmentSummaries']
): string[] {
  const dir = join(outputDir, 'equips')
  mkdirSync(dir, { recursive: true })
  return SUPPORTED_LOCALES.map((locale) => {
    const path = join(dir, `${locale}.json`)
    let existing: Record<string, string> = {}
    try {
      existing = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>
    } catch {}
    for (const equipment of summaries) {
      existing[equipment.id] ??= equipment.name[locale] || equipment.name['zh-CN'] || equipment.id
    }
    writeFileSync(path, `${JSON.stringify(existing, null, 2)}\n`, 'utf8')
    return path
  })
}

export interface WikiDataResult {
  categories: string[]
  files: string[]
  counts: Record<string, number>
  itemData: ItemWikiData
  assets: WikiAssets
}
export function generateWikiData(
  akedataPath: string,
  imagedbPath: string,
  generatedI18nDir: string,
  dataOutputDir: string,
  characters: CharacterWikiData
): WikiDataResult {
  const textTables = loadAllTextTables(akedataPath)
  const gameTextTable = loadTable(akedataPath, 'TextTable') as Record<string, GameTextEntry>
  const source: ItemWikiSource = {
    itemTable: loadTable(akedataPath, 'ItemTable') as ItemWikiSource['itemTable'],
    weaponBasicTable: loadTable(akedataPath, 'WeaponBasicTable') as ItemWikiSource['weaponBasicTable'],
    weaponUpgradeTemplateTable: loadTable(akedataPath, 'WeaponUpgradeTemplateTable') as ItemWikiSource['weaponUpgradeTemplateTable'],
    weaponBreakthroughTemplateTable: loadTable(akedataPath, 'WeaponBreakThroughTemplateTable') as ItemWikiSource['weaponBreakthroughTemplateTable'],
    skillPatchTable: loadTable(akedataPath, 'SkillPatchTable') as ItemWikiSource['skillPatchTable'],
    equipTable: loadTable(akedataPath, 'EquipTable') as ItemWikiSource['equipTable'],
    equipSuitTable: loadTable(akedataPath, 'EquipSuitTable') as ItemWikiSource['equipSuitTable'],
    equipFormulaTable: loadTable(akedataPath, 'EquipFormulaTable') as ItemWikiSource['equipFormulaTable'],
    equipFormulaChainTable: loadTable(akedataPath, 'EquipFormulaChainTable') as ItemWikiSource['equipFormulaChainTable'],
    equipStatFormats: buildAttrShowConfigs(akedataPath),
    textTables,
  }
  const generated = buildItemWikiData(source)
  const assets = collectWikiAssets({ characters, items: generated })
  const assetPath = join(dataOutputDir, 'wiki', 'assets.json')
  writeFileSync(assetPath, `${JSON.stringify(assets, null, 2)}\n`, 'utf8')
  const glossaryPath = join(dataOutputDir, 'wiki', 'rich-text.json')
  const glossary = buildWikiGlossary(
    loadTable(akedataPath, 'HyperlinkTextTable') as Record<string, HyperlinkTextEntry>,
    textTables
  )
  writeFileSync(glossaryPath, `${JSON.stringify(glossary, null, 2)}\n`, 'utf8')
  const enumOutput = buildEnums(akedataPath, imagedbPath, dataOutputDir, textTables, gameTextTable)
  const planner = buildPlannerGameData(akedataPath, characters, generated)
  const catalogs = buildWikiI18nCatalogs(characters, generated, enumOutput.enums, glossary, planner, gameTextTable, textTables)
  const files = [
    writeSummaryFile(dataOutputDir, 'weapons', generated.weaponSummaries),
    writeSummaryFile(dataOutputDir, 'equipment', generated.equipmentSummaries),
    ...writeDetailFiles(dataOutputDir, 'weapons', generated.weaponDetails),
    ...writeDetailFiles(dataOutputDir, 'equipment', generated.equipmentDetails),
    writePlannerPreviewFile(dataOutputDir, generated),
    writePlannerGameData(dataOutputDir, planner),
    enumOutput.path,
    ...writeWikiI18nFiles(generatedI18nDir, catalogs),
    ...writeEquipmentNameFiles(generatedI18nDir, generated.equipmentSummaries),
    assetPath,
    glossaryPath,
  ]
  return {
    categories: ['weapons', 'equipment'],
    files,
    counts: {
      weapons: generated.weaponSummaries.length,
      equipment: generated.equipmentSummaries.length,
    },
    itemData: generated,
    assets,
  }
}
