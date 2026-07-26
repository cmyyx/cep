import type {
  WikiCharacterSummary,
  WikiEntitySummary,
  WikiEquipmentSummary,
  WikiWeaponSummary,
} from '@/types/wiki'
import { localizeText } from '@/lib/wiki-locale-detail'

type WithLocalizedName<T extends { name: unknown }> = Omit<T, 'name' | 'suitName'> & {
  name: string
  /** Original zh-CN name for banner UP matching (characters). */
  nameZhCN?: string
  suitName?: string
  /** i18n key of the equipment model tier badge, resolved at build time from the zh-CN name. */
  modelKey?: string
}

/**
 * Equipment model tier ("壹型" / "T1" / "Ⅰ" / "·I") is only spelled out consistently in the
 * zh-CN name: en uses "T1", ja bare roman numerals, zh-TW latin "·I". Resolve the tier from
 * zh-CN once at build time so every locale renders the same badge.
 */
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
): LocalizedWikiEntitySummary {
  if (entity.category === 'characters') {
    return {
      ...entity,
      name: localizeText(entity.name, locale),
      nameZhCN: entity.name['zh-CN'],
    }
  }
  if (entity.category === 'weapons') {
    return {
      ...entity,
      name: localizeText(entity.name, locale),
    }
  }
  const { suitName: rawSuitName, ...rest } = entity
  const modelKey = equipmentModelKeyFromZhCN(entity.name['zh-CN'])
  return {
    ...rest,
    name: localizeText(entity.name, locale),
    ...(rawSuitName ? { suitName: localizeText(rawSuitName, locale) } : {}),
    ...(modelKey ? { modelKey } : {}),
  }
}

export function localizeWikiEntitySummaries(
  entities: readonly WikiEntitySummary[],
  locale: string,
): LocalizedWikiEntitySummary[] {
  return entities.map((entity) => localizeWikiEntitySummary(entity, locale))
}

export function entityDisplayName(
  entity: { name: string | { 'zh-CN'?: string; en?: string; ja?: string; 'zh-TW'?: string }; id: string },
  locale: string,
): string {
  if (typeof entity.name === 'string') return entity.name
  return localizeText(entity.name as { 'zh-CN': string; en: string; ja: string; 'zh-TW': string }, locale) || entity.id
}

export function entityNameZhCN(
  entity: { name: string | { 'zh-CN'?: string }; nameZhCN?: string; id: string },
): string {
  if (entity.nameZhCN) return entity.nameZhCN
  if (typeof entity.name === 'string') return entity.name
  return entity.name['zh-CN'] || entity.id
}

export type { WikiCharacterSummary, WikiWeaponSummary, WikiEquipmentSummary }
