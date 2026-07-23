/**
 * Generated game i18n catalogs for client-side lookup.
 *
 * Long-form wiki text (wikiData) must NOT go through NextIntlClientProvider:
 * static export serializes provider messages into every page HTML/RSC payload.
 * These imports land in shared JS chunks instead (one copy site-wide).
 *
 * Full catalogs remain available to the server via loadMessages() for SSG.
 */
import charactersEn from '@/generated/i18n/characters/en.json'
import charactersJa from '@/generated/i18n/characters/ja.json'
import charactersZhCN from '@/generated/i18n/characters/zh-CN.json'
import charactersZhTW from '@/generated/i18n/characters/zh-TW.json'
import equipsEn from '@/generated/i18n/equips/en.json'
import equipsJa from '@/generated/i18n/equips/ja.json'
import equipsZhCN from '@/generated/i18n/equips/zh-CN.json'
import equipsZhTW from '@/generated/i18n/equips/zh-TW.json'
import equipStatsEn from '@/generated/i18n/equipStats/en.json'
import equipStatsJa from '@/generated/i18n/equipStats/ja.json'
import equipStatsZhCN from '@/generated/i18n/equipStats/zh-CN.json'
import equipStatsZhTW from '@/generated/i18n/equipStats/zh-TW.json'
import weaponsEn from '@/generated/i18n/weapons/en.json'
import weaponsJa from '@/generated/i18n/weapons/ja.json'
import weaponsZhCN from '@/generated/i18n/weapons/zh-CN.json'
import weaponsZhTW from '@/generated/i18n/weapons/zh-TW.json'
import wikiDataEn from '@/generated/i18n/wikiData/en.json'
import wikiDataJa from '@/generated/i18n/wikiData/ja.json'
import wikiDataZhCN from '@/generated/i18n/wikiData/zh-CN.json'
import wikiDataZhTW from '@/generated/i18n/wikiData/zh-TW.json'
import type { WikiLocale } from '@/types/wiki'

type StringCatalog = Record<string, string>

export type GameI18nNamespace =
  | 'characters'
  | 'weapons'
  | 'equips'
  | 'equipStats'
  | 'wikiData'

const catalogs: Record<GameI18nNamespace, Record<WikiLocale, StringCatalog>> = {
  characters: {
    en: charactersEn,
    ja: charactersJa,
    'zh-CN': charactersZhCN,
    'zh-TW': charactersZhTW,
  },
  weapons: {
    en: weaponsEn,
    ja: weaponsJa,
    'zh-CN': weaponsZhCN,
    'zh-TW': weaponsZhTW,
  },
  equips: {
    en: equipsEn,
    ja: equipsJa,
    'zh-CN': equipsZhCN,
    'zh-TW': equipsZhTW,
  },
  equipStats: {
    en: equipStatsEn,
    ja: equipStatsJa,
    'zh-CN': equipStatsZhCN,
    'zh-TW': equipStatsZhTW,
  },
  wikiData: {
    en: wikiDataEn,
    ja: wikiDataJa,
    'zh-CN': wikiDataZhCN,
    'zh-TW': wikiDataZhTW,
  },
}

export function getGameI18nCatalog(
  locale: WikiLocale,
  namespace: GameI18nNamespace,
): StringCatalog {
  return catalogs[namespace][locale]
}

export function lookupGameI18n(
  locale: WikiLocale,
  namespace: GameI18nNamespace,
  key: string,
): string | undefined {
  const value = catalogs[namespace][locale][key]
  return typeof value === 'string' ? value : undefined
}

export function hasGameI18n(
  locale: WikiLocale,
  namespace: GameI18nNamespace,
  key: string,
): boolean {
  return typeof catalogs[namespace][locale][key] === 'string'
}
