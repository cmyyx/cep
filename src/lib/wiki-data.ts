import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  WikiCharacterDetail,
  WikiEquipmentDetail,
  WikiWeaponDetail,
} from '@/types/wiki'
import { toLocaleDetail, type LocalizeDeep } from '@/lib/wiki-locale-detail'
import { compactWikiMaterials, type WikiMaterialCatalog } from '@/lib/wiki-material-compact'

function readWikiDetail<T>(category: string, id: string): T | null {
  if (!/^[a-z0-9_:-]+$/i.test(id)) return null
  try {
    return JSON.parse(
      readFileSync(
        join(process.cwd(), 'src', 'generated', 'data', 'wiki', category, `${id}.json`),
        'utf8'
      )
    ) as T
  } catch {
    return null
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

export type LocalizedWikiPageData<T> = {
  detail: T
  catalog: WikiMaterialCatalog
}

function localizeAndCompact<T>(detail: T, locale: string): LocalizedWikiPageData<LocalizeDeep<T>> {
  const localized = toLocaleDetail(detail, locale)
  const { value, catalog } = compactWikiMaterials(localized, locale)
  return { detail: value, catalog }
}

export function getLocalizedCharacterWikiDetail(
  id: string,
  locale: string,
): LocalizedWikiPageData<LocalizeDeep<WikiCharacterDetail>> | null {
  const detail = getCharacterWikiDetail(id)
  return detail ? localizeAndCompact(detail, locale) : null
}

export function getLocalizedWeaponWikiDetail(
  id: string,
  locale: string,
): LocalizedWikiPageData<LocalizeDeep<WikiWeaponDetail>> | null {
  const detail = getWeaponWikiDetail(id)
  return detail ? localizeAndCompact(detail, locale) : null
}

export function getLocalizedEquipmentWikiDetail(
  id: string,
  locale: string,
): LocalizedWikiPageData<LocalizeDeep<WikiEquipmentDetail>> | null {
  const detail = getEquipmentWikiDetail(id)
  return detail ? localizeAndCompact(detail, locale) : null
}
