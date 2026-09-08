import type {
  WikiCharacterSummary,
  WikiEntitySummary,
  WikiEquipmentSummary,
  WikiWeaponSummary,
} from '@/types/wiki'
import { localizeText } from '@/lib/wiki-locale-detail'

type WithLocalizedName<T> = Omit<T, 'name' | 'suitName'> & {
  name: string
  /** Original zh-CN name for banner UP matching (characters). */
  nameZhCN?: string
  suitName?: string
  /** i18n key of the equipment model tier badge. */
  modelKey?: string
}

const EQUIPMENT_MODEL_KEYS: Array<[string, string]> = [
  ['壹型', 'refinement.modelTypeI'],
  ['贰型', 'refinement.modelTypeII'],
  ['叁型', 'refinement.modelTypeIII'],
  ['Ⅰ型', 'refinement.modelTypeI'],
  ['Ⅱ型', 'refinement.modelTypeII'],
  ['Ⅲ型', 'refinement.modelTypeIII'],
]

export function equipmentModelKeyFromZhCN(nameZhCN: string): string | undefined {
  return EQUIPMENT_MODEL_KEYS.find(([suffix]) => nameZhCN.includes(`·${suffix}`))?.[1]
}

export type LocalizedWikiCharacterSummary = WithLocalizedName<WikiCharacterSummary>
export type LocalizedWikiWeaponSummary = WithLocalizedName<WikiWeaponSummary>
export type LocalizedWikiEquipmentSummary = WithLocalizedName<WikiEquipmentSummary>
export type LocalizedWikiEntitySummary =
  | LocalizedWikiCharacterSummary
  | LocalizedWikiWeaponSummary
  | LocalizedWikiEquipmentSummary

export function localizeWikiEntitySummary(
  entity: WikiEntitySummary,
  locale: string,
  resolveName: (entity: WikiEntitySummary) => string = (value) => value.name ? localizeText(value.name, locale) : value.id,
): LocalizedWikiEntitySummary {
  const name = resolveName(entity) || entity.id
  if (entity.category === 'characters') {
    return { ...entity, name, ...(entity.name ? { nameZhCN: entity.name['zh-CN'] } : {}) }
  }
  if (entity.category === 'weapons') return { ...entity, name }
  const { suitName: rawSuitName, ...rest } = entity
  const modelKey = entity.name ? equipmentModelKeyFromZhCN(entity.name['zh-CN']) : undefined
  return {
    ...rest,
    name,
    ...(rawSuitName ? { suitName: localizeText(rawSuitName, locale) } : {}),
    ...(modelKey ? { modelKey } : {}),
  }
}

export function localizeWikiEntitySummaries(
  entities: readonly WikiEntitySummary[],
  locale: string,
  resolveName?: (entity: WikiEntitySummary) => string,
): LocalizedWikiEntitySummary[] {
  return entities.map((entity) => localizeWikiEntitySummary(entity, locale, resolveName))
}

export function entityDisplayName(
  entity: { name?: string | { 'zh-CN'?: string; en?: string; ja?: string; 'zh-TW'?: string }; id: string },
  locale: string,
): string {
  if (typeof entity.name === 'string') return entity.name
  if (entity.name) return localizeText(entity.name as { 'zh-CN': string; en: string; ja: string; 'zh-TW': string }, locale) || entity.id
  return entity.id
}

export function entityNameZhCN(
  entity: { name?: string | { 'zh-CN'?: string }; nameZhCN?: string; id: string },
): string {
  if (entity.nameZhCN) return entity.nameZhCN
  if (typeof entity.name === 'string') return entity.name
  return entity.name?.['zh-CN'] || entity.id
}

export type { WikiCharacterSummary, WikiWeaponSummary, WikiEquipmentSummary }
