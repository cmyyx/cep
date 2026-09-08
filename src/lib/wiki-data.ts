import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  LocalizedText,
  WikiCharacterDetail,
  WikiEquipmentDetail,
  WikiLocale,
  WikiMaterial,
  WikiWeaponDetail,
} from '@/types/wiki'
import { toLocaleDetail, type LocalizeDeep } from '@/lib/wiki-locale-detail'
import { asWikiLocale } from '@/lib/wiki-locale'
import { compactWikiMaterials, type WikiMaterialCatalog } from '@/lib/wiki-material-compact'
import { wikiTextKey } from '@/lib/wiki-i18n'
import wikiDataEn from '@/generated/i18n/wikiData/en.json'
import wikiDataJa from '@/generated/i18n/wikiData/ja.json'
import wikiDataZhCN from '@/generated/i18n/wikiData/zh-CN.json'
import wikiDataZhTW from '@/generated/i18n/wikiData/zh-TW.json'

type Catalog = Record<string, string>
const catalogs: Record<WikiLocale, Catalog> = {
  en: wikiDataEn,
  ja: wikiDataJa,
  'zh-CN': wikiDataZhCN,
  'zh-TW': wikiDataZhTW,
}

function readWikiDetail<T>(category: string, id: string): T | null {
  if (!/^[a-z0-9_:-]+$/i.test(id)) return null
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'src', 'generated', 'data', 'wiki', category, `${id}.json`), 'utf8')) as T
  } catch {
    return null
  }
}

function text(locale: WikiLocale, ...segments: Array<string | number>): string {
  return catalogs[locale][wikiTextKey(...segments)] ?? ''
}

function localizedText(...segments: Array<string | number>): LocalizedText {
  return {
    'zh-CN': text('zh-CN', ...segments),
    en: text('en', ...segments),
    ja: text('ja', ...segments),
    'zh-TW': text('zh-TW', ...segments),
  }
}

function material(material: Omit<WikiMaterial, 'name'> & { name?: string | LocalizedText }): WikiMaterial {
  const name = material.name && typeof material.name === 'object'
    ? material.name
    : localizedText('item', material.itemId)
  return { ...material, name }
}

function hydrateWeaponDetail(raw: WikiWeaponDetail): WikiWeaponDetail {

  return {
    ...raw,
    skills: raw.skills.map((skill) => ({
      ...skill,
      name: localizedText('weapon', raw.id, 'skill', skill.id, 'name'),
      description: localizedText('weapon', raw.id, 'skill', skill.id, 'description'),
      levels: skill.levels.map((level) => ({
        ...level,
        description: localizedText('weapon', raw.id, 'skill', skill.id, 'level', level.level),
      })),
    })),
    breakthroughs: raw.breakthroughs.map((breakthrough) => ({
      ...breakthrough,
      materials: breakthrough.materials.map(material),
    })),
  }
}
function hydrateEquipmentDetail(raw: WikiEquipmentDetail, locale: WikiLocale): WikiEquipmentDetail {
  return {
    ...raw,
    stats: raw.stats.map((stat) => {
      const catalogValues = stat.values.map((_, index) => text(locale, 'equipment', raw.id, 'stat', stat.attributeId, 'value', index))
      const displayValues = catalogValues.length > 0 && catalogValues.every(Boolean) ? catalogValues : stat.displayValues
      return { ...stat, ...(displayValues ? { displayValues } : {}) }
    }),
    suitEffects: raw.suitEffects.map((effect) => ({
      ...effect,
      name: localizedText('equipment', raw.id, 'effect', effect.id, 'name'),
      description: localizedText('equipment', raw.id, 'effect', effect.id, 'description'),
    })),
    craftingRecipes: raw.craftingRecipes.map((recipe) => ({
      ...recipe,
      materials: recipe.materials.map(material),
    })),
  }
}

function hydrateCharacterDetail(raw: WikiCharacterDetail): WikiCharacterDetail {
  return {
    ...raw,
    skills: raw.skills.map((skill) => ({
      ...skill,
      name: localizedText('character', raw.id, 'skill', skill.id, 'name'),
      description: localizedText('character', raw.id, 'skill', skill.id, 'description'),
      metrics: skill.metrics.map((metric) => ({ ...metric, label: localizedText('character', raw.id, 'skill', skill.id, 'metric', metric.id) })),
      levels: skill.levels.map((level) => ({ ...level, materials: level.materials?.map(material) })),
      variants: skill.variants?.map((variant) => ({
        ...variant,
        name: localizedText('character', raw.id, 'variant', variant.id, 'name'),
        condition: localizedText('character', raw.id, 'variant', variant.id, 'condition'),
        description: localizedText('character', raw.id, 'variant', variant.id, 'description'),
        metrics: variant.metrics.map((metric) => ({ ...metric, label: localizedText('character', raw.id, 'variant', variant.id, 'metric', metric.id) })),
        levels: variant.levels.map((level) => ({ ...level, materials: level.materials?.map(material) })),
      })),
    })),
    talents: raw.talents.map((talent) => ({ ...talent, name: localizedText('character', raw.id, 'talent', talent.id, 'name'), description: localizedText('character', raw.id, 'talent', talent.id, 'description'), materials: talent.materials.map(material) })),
    attributeNodes: raw.attributeNodes.map((node) => ({ ...node, title: localizedText('character', raw.id, 'attribute', node.id, 'name'), description: localizedText('character', raw.id, 'attribute', node.id, 'description'), materials: node.materials.map(material) })),
    equipmentNodes: raw.equipmentNodes.map((node) => ({ ...node, name: localizedText('character', raw.id, 'equipment', node.id, 'name'), description: localizedText('character', raw.id, 'equipment', node.id, 'description'), materials: node.materials.map(material) })),
    logisticsSkills: raw.logisticsSkills.map((skill) => ({ ...skill, name: localizedText('character', raw.id, 'logistics', skill.id, 'name'), description: localizedText('character', raw.id, 'logistics', skill.id, 'description'), unlockHint: localizedText('character', raw.id, 'logistics', skill.id, 'unlockHint') })),
    potentials: raw.potentials.map((potential) => ({ ...potential, name: localizedText('character', raw.id, 'potential', potential.id, 'name'), description: localizedText('character', raw.id, 'potential', potential.id, 'description') })),
    cvNames: raw.cvNames.map((voice) => ({ ...voice, localized: localizedText('character', raw.id, 'voice', voice.language) })),
    promotions: raw.promotions.map((promotion) => ({ ...promotion, materials: promotion.materials.map(material) })),
  }
}

export function getCharacterWikiDetail(id: string): WikiCharacterDetail | null {
  return readWikiDetail<WikiCharacterDetail>('characters', id)
}

export function getWeaponWikiDetail(id: string): WikiWeaponDetail | null {
  return readWikiDetail<WikiWeaponDetail>('weapons', id)
}

export function getEquipmentWikiDetail(id: string): WikiEquipmentDetail | null {
  return readWikiDetail<WikiEquipmentDetail>('equipment', id)
}

export type LocalizedWikiPageData<T> = { detail: T; catalog: WikiMaterialCatalog }

export function getLocalizedCharacterWikiDetail(id: string, locale: string): LocalizedWikiPageData<LocalizeDeep<WikiCharacterDetail>> | null {
  const raw = getCharacterWikiDetail(id)
  if (!raw) return null
  const localized = toLocaleDetail(hydrateCharacterDetail(raw), locale)
  const compacted = compactWikiMaterials(localized, locale)
  return { detail: compacted.value, catalog: compacted.catalog }
}

export function getLocalizedWeaponWikiDetail(id: string, locale: string): LocalizedWikiPageData<LocalizeDeep<WikiWeaponDetail>> | null {
  const raw = getWeaponWikiDetail(id)
  if (!raw) return null
  const localized = toLocaleDetail(hydrateWeaponDetail(raw), locale)
  const compacted = compactWikiMaterials(localized, locale)
  return { detail: compacted.value, catalog: compacted.catalog }
}

export function getLocalizedEquipmentWikiDetail(id: string, locale: string): LocalizedWikiPageData<LocalizeDeep<WikiEquipmentDetail>> | null {
  const raw = getEquipmentWikiDetail(id)
  if (!raw) return null
  const localized = toLocaleDetail(hydrateEquipmentDetail(raw, asWikiLocale(locale)), locale)
  const compacted = compactWikiMaterials(localized, locale)
  return { detail: compacted.value, catalog: compacted.catalog }
}
