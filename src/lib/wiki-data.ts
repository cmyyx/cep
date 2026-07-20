import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  WikiCharacterDetail,
  WikiEquipmentDetail,
  WikiWeaponDetail,
} from '@/types/wiki'

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
