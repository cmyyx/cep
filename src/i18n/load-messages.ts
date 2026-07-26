import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import zhCN from '@/messages/zh-CN.json'
import zhTW from '@/messages/zh-TW.json'
import charactersEn from '@/generated/i18n/characters/en.json'
import charactersJa from '@/generated/i18n/characters/ja.json'
import charactersZhCN from '@/generated/i18n/characters/zh-CN.json'
import charactersZhTW from '@/generated/i18n/characters/zh-TW.json'
import dungeonsEn from '@/generated/i18n/dungeons/en.json'
import dungeonsJa from '@/generated/i18n/dungeons/ja.json'
import dungeonsZhCN from '@/generated/i18n/dungeons/zh-CN.json'
import dungeonsZhTW from '@/generated/i18n/dungeons/zh-TW.json'
import equipStatsEn from '@/generated/i18n/equipStats/en.json'
import equipStatsJa from '@/generated/i18n/equipStats/ja.json'
import equipStatsZhCN from '@/generated/i18n/equipStats/zh-CN.json'
import equipStatsZhTW from '@/generated/i18n/equipStats/zh-TW.json'
import equipTypesEn from '@/generated/i18n/equipTypes/en.json'
import equipTypesJa from '@/generated/i18n/equipTypes/ja.json'
import equipTypesZhCN from '@/generated/i18n/equipTypes/zh-CN.json'
import equipTypesZhTW from '@/generated/i18n/equipTypes/zh-TW.json'
import equipsEn from '@/generated/i18n/equips/en.json'
import equipsJa from '@/generated/i18n/equips/ja.json'
import equipsZhCN from '@/generated/i18n/equips/zh-CN.json'
import equipsZhTW from '@/generated/i18n/equips/zh-TW.json'
import gemStatsEn from '@/generated/i18n/gemStats/en.json'
import gemStatsJa from '@/generated/i18n/gemStats/ja.json'
import gemStatsZhCN from '@/generated/i18n/gemStats/zh-CN.json'
import gemStatsZhTW from '@/generated/i18n/gemStats/zh-TW.json'
import materialsEn from '@/generated/i18n/materials/en.json'
import materialsJa from '@/generated/i18n/materials/ja.json'
import materialsZhCN from '@/generated/i18n/materials/zh-CN.json'
import materialsZhTW from '@/generated/i18n/materials/zh-TW.json'
import regionsEn from '@/generated/i18n/regions/en.json'
import regionsJa from '@/generated/i18n/regions/ja.json'
import regionsZhCN from '@/generated/i18n/regions/zh-CN.json'
import regionsZhTW from '@/generated/i18n/regions/zh-TW.json'
import suitsEn from '@/generated/i18n/suits/en.json'
import suitsJa from '@/generated/i18n/suits/ja.json'
import suitsZhCN from '@/generated/i18n/suits/zh-CN.json'
import suitsZhTW from '@/generated/i18n/suits/zh-TW.json'
import weaponsEn from '@/generated/i18n/weapons/en.json'
import weaponsJa from '@/generated/i18n/weapons/ja.json'
import weaponsZhCN from '@/generated/i18n/weapons/zh-CN.json'
import weaponsZhTW from '@/generated/i18n/weapons/zh-TW.json'
import weaponStatsEn from '@/generated/i18n/weaponStats/en.json'
import weaponStatsJa from '@/generated/i18n/weaponStats/ja.json'
import weaponStatsZhCN from '@/generated/i18n/weaponStats/zh-CN.json'
import weaponStatsZhTW from '@/generated/i18n/weaponStats/zh-TW.json'
import wikiDataEn from '@/generated/i18n/wikiData/en.json'
import wikiDataJa from '@/generated/i18n/wikiData/ja.json'
import wikiDataZhCN from '@/generated/i18n/wikiData/zh-CN.json'
import wikiDataZhTW from '@/generated/i18n/wikiData/zh-TW.json'
import routeShellMessages from './route-shell-messages.json'
import type { WikiLocale } from '@/types/wiki'

/** Hand-written UI strings only. */
const shellMessages = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  en,
} satisfies Record<WikiLocale, object>

type CatalogBag = {
  characters: object
  dungeons: object
  equipStats: object
  equipTypes: object
  equips: object
  gemStats: object
  materials: object
  region: object
  suits: object
  weapons: object
  weaponStats: object
}

/**
 * Short generated name tables used by client planners via useTranslations.
 * Intentionally excludes wikiData (~0.9MB) which is loaded per-locale via game-i18n-catalogs dynamic import
 * so static export does not embed it in every page's RSC payload.
 */
const plannerCatalogs = {
  'zh-CN': {
    characters: charactersZhCN,
    dungeons: dungeonsZhCN,
    equipStats: equipStatsZhCN,
    equipTypes: equipTypesZhCN,
    equips: equipsZhCN,
    gemStats: gemStatsZhCN,
    materials: materialsZhCN,
    region: regionsZhCN,
    suits: suitsZhCN,
    weapons: weaponsZhCN,
    weaponStats: weaponStatsZhCN,
  },
  'zh-TW': {
    characters: charactersZhTW,
    dungeons: dungeonsZhTW,
    equipStats: equipStatsZhTW,
    equipTypes: equipTypesZhTW,
    equips: equipsZhTW,
    gemStats: gemStatsZhTW,
    materials: materialsZhTW,
    region: regionsZhTW,
    suits: suitsZhTW,
    weapons: weaponsZhTW,
    weaponStats: weaponStatsZhTW,
  },
  ja: {
    characters: charactersJa,
    dungeons: dungeonsJa,
    equipStats: equipStatsJa,
    equipTypes: equipTypesJa,
    equips: equipsJa,
    gemStats: gemStatsJa,
    materials: materialsJa,
    region: regionsJa,
    suits: suitsJa,
    weapons: weaponsJa,
    weaponStats: weaponStatsJa,
  },
  en: {
    characters: charactersEn,
    dungeons: dungeonsEn,
    equipStats: equipStatsEn,
    equipTypes: equipTypesEn,
    equips: equipsEn,
    gemStats: gemStatsEn,
    materials: materialsEn,
    region: regionsEn,
    suits: suitsEn,
    weapons: weaponsEn,
    weaponStats: weaponStatsEn,
  },
} satisfies Record<WikiLocale, CatalogBag>

const wikiDataCatalogs = {
  'zh-CN': wikiDataZhCN,
  'zh-TW': wikiDataZhTW,
  ja: wikiDataJa,
  en: wikiDataEn,
} satisfies Record<WikiLocale, object>

/** Route-scoped catalog slices — only namespaces the route actually needs via useTranslations. */
export type PlannerCatalogProfile =
  | 'all'
  | 'essence'
  | 'refinement'
  | 'account'

const PLANNER_CATALOG_KEYS = {
  all: [
    'characters',
    'dungeons',
    'equipStats',
    'equipTypes',
    'equips',
    'gemStats',
    'materials',
    'region',
    'suits',
    'weapons',
    'weaponStats',
  ],
  /** Essence planner: weapons + dungeon/gem/stat labels + region filter chips. No equips. */
  essence: ['weapons', 'dungeons', 'gemStats', 'weaponStats', 'region'],
  /** Refinement planner: equipment tables only. */
  refinement: ['equips', 'equipStats', 'equipTypes', 'suits', 'materials'],
  /** Account sync conflict UI: equip display names + region labels (settings diff). */
  account: ['equips', 'region'],
} as const satisfies Record<PlannerCatalogProfile, readonly (keyof CatalogBag)[]>

type MessageRecord = Record<string, unknown>

/** Pick a top-level key subset from one namespace object; missing key = build-time error. */
function pickMessageKeys(
  namespace: string,
  source: MessageRecord,
  keys: readonly string[],
): MessageRecord {
  const out: MessageRecord = {}
  for (const key of keys) {
    if (!(key in source)) {
      throw new Error(`route-shell-messages: key "${namespace}.${key}" 不存在于 messages JSON`)
    }
    out[key] = source[key]
  }
  return out
}

function shellNamespace(locale: WikiLocale, namespace: string): MessageRecord {
  const shell = shellMessages[locale] as Record<string, MessageRecord>
  const source = shell[namespace]
  if (!source) {
    throw new Error(`route-shell-messages: 命名空间 "${namespace}" 不存在于 messages JSON`)
  }
  return source
}

/**
 * Global ClientProvider messages: CORE shell only — namespaces/keys consumed by
 * client components mounted in the root [locale] layout tree on every page
 * (sidebar, sync notifier, banners, dialogs, watermark...).
 * Everything else is injected per-route via RouteMessages (see route-shell-messages.json)
 * so each static page's HTML/RSC payload only carries what its route uses.
 */
export function loadClientMessages(locale: WikiLocale): MessageRecord {
  const core: MessageRecord = {}
  for (const namespace of routeShellMessages.coreNamespaces) {
    core[namespace] = shellNamespace(locale, namespace)
  }
  for (const [namespace, keys] of Object.entries(routeShellMessages.corePicks)) {
    core[namespace] = pickMessageKeys(namespace, shellNamespace(locale, namespace), keys)
  }
  return core
}

export type RouteMessagesKey = keyof typeof routeShellMessages.routes

/**
 * Route-scoped shell namespaces/subsets for a RouteMessages nested provider.
 * Full namespaces replace the core's key-level subset wholesale (superset merge).
 */
export function loadRouteShellMessages(
  locale: WikiLocale,
  route: RouteMessagesKey,
): MessageRecord {
  const config = routeShellMessages.routes[route] as {
    namespaces?: readonly string[]
    picks?: Record<string, readonly string[]>
  }
  const out: MessageRecord = {}
  for (const namespace of config.namespaces ?? []) {
    out[namespace] = shellNamespace(locale, namespace)
  }
  for (const [namespace, keys] of Object.entries(config.picks ?? {})) {
    out[namespace] = pickMessageKeys(namespace, shellNamespace(locale, namespace), keys)
  }
  return out
}

/** Planner catalog namespaces for a locale (no UI shell, no wikiData). */
export function loadPlannerCatalogs(
  locale: WikiLocale,
  profile: PlannerCatalogProfile = 'all',
): Record<string, object> {
  const bag = plannerCatalogs[locale]
  const keys = PLANNER_CATALOG_KEYS[profile]
  const out: Record<string, object> = {}
  for (const key of keys) {
    out[key] = bag[key]
  }
  return out
}

/** Shell + planner catalogs — for routes that need t('equips.*') / t('weapons.*') on the client. */
export function loadPlannerClientMessages(
  locale: WikiLocale,
  profile: PlannerCatalogProfile = 'all',
) {
  return {
    ...shellMessages[locale],
    ...loadPlannerCatalogs(locale, profile),
  }
}

/**
 * Full messages for server-side getTranslations / getRequestConfig during SSG.
 * Includes wikiData so wiki pages can resolve long-form text at build time.
 */
export function loadMessages(locale: WikiLocale) {
  return {
    ...loadPlannerClientMessages(locale, 'all'),
    wikiData: wikiDataCatalogs[locale],
  }
}
