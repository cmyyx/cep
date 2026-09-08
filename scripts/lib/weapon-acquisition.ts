import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { LocalizedText, WikiLocale } from '../../src/types/wiki'
import type { WeaponAcquisitionSource, WeaponAcquisitionSourceMap } from '../../src/types/weapon-acquisition'
import { parseJsonSafe } from './json-utils'
import { loadAllTextTables } from './stat-mapping'
import { localizeWikiText, type TextRef, type WikiTextTables } from './wiki-builder-utils'

const LOCALES: readonly WikiLocale[] = ['zh-CN', 'en', 'ja', 'zh-TW']

export interface WeaponAcquisitionI18nEntry {
  source: WeaponAcquisitionSource
  name: LocalizedText
  description?: LocalizedText
}

export interface WeaponAcquisitionData {
  sourcesByWeapon: WeaponAcquisitionSourceMap
  categories: Record<string, LocalizedText>
  details: Record<string, WeaponAcquisitionI18nEntry>
  warnings: string[]
}

interface ItemRecord {
  obtainWayIds?: unknown
  name?: TextRef
  desc?: TextRef
}

interface SystemJumpRecord {
  desc?: TextRef
}

interface GachaPoolRecord {
  name?: TextRef
  loopRewardShowTitle?: TextRef
}

interface GachaPoolContentRecord {
  list?: Array<{ itemId?: string }>
}

interface ShopGoodsRecord {
  shopId?: string
  rewardId?: string
  weaponGachaPoolId?: string
  relatedWeaponGachPoolId?: string
}

interface RewardRecord {
  itemBundles?: Array<{ id?: string }>
  probItemBundles?: Array<{ id?: string }>
}

interface ChestRecord {
  rewardIdList?: string[]
  randomChestItemIds?: string[]
}

interface ShopRecord {
  shopGroupId?: string
  shopName?: TextRef
}

interface ShopGroupRecord {
  shopGroupName?: TextRef
}

/** Obtain-way ids that are shared by every weapon (e.g. the armory exchange
 * entry "采购中心-武库交易所") — a per-weapon source record would be pure
 * noise, so they are dropped before categorization. */
const IGNORED_OBTAIN_WAYS = new Set([
  'item_obtain_payshop_weapon',
  'item_obtain_payshop_weapon_gift',
])

const CATEGORY_BY_OBTAIN_WAY: Record<string, string> = {
  item_obtain_activity: 'activity',
  item_obtain_bp: 'battlePass',
  item_obtain_bp_mission: 'battlePass',
  item_obtain_bp_pay: 'battlePass',
  item_obtain_explore: 'explore',
  item_obtain_gacha: 'gacha',
}

const CATEGORY_FALLBACKS: Record<string, LocalizedText> = {
  activity: {
    'zh-CN': '活动',
    en: 'Activity',
    ja: 'イベント',
    'zh-TW': '活動',
  },
  battlePass: {
    'zh-CN': '通行证',
    en: 'Battle Pass',
    ja: 'バトルパス',
    'zh-TW': '通行證',
  },
  chest: {
    'zh-CN': '自选箱',
    en: 'Selection Chest',
    ja: '選択ボックス',
    'zh-TW': '自選箱',
  },
  explore: {
    'zh-CN': '探索',
    en: 'Exploration',
    ja: '探索',
    'zh-TW': '探索',
  },
  gacha: {
    'zh-CN': '武器抽取',
    en: 'Weapon Gacha',
    ja: '武器スカウト',
    'zh-TW': '武器抽取',
  },
  shop: {
    'zh-CN': '商店兑换',
    en: 'Shop Exchange',
    ja: 'ショップ交換',
    'zh-TW': '商店兌換',
  },
  unknown: {
    'zh-CN': '未知',
    en: 'Unknown',
    ja: '不明',
    'zh-TW': '未知',
  },
}

function table<T>(akedataPath: string, name: string): Record<string, T> {
  const path = join(akedataPath, 'TableCfg', `${name}.json`)
  return existsSync(path) ? parseJsonSafe(path) as Record<string, T> : {}
}

function textRefId(value: TextRef | undefined): string | undefined {
  const id = value?.id === undefined ? undefined : String(value.id)
  return !id || id === '0' ? undefined : id
}

function fallbackText(value: string): LocalizedText {
  return Object.fromEntries(LOCALES.map((locale) => [locale, value])) as LocalizedText
}

function addSource(
  map: Map<string, Set<string>>,
  weaponId: string,
  categoryId: string,
  sourceId: string,
): void {
  const key = `${categoryId}\u0000${sourceId}`
  const values = map.get(weaponId) ?? new Set<string>()
  values.add(key)
  map.set(weaponId, values)
}

function addDetail(
  details: Map<string, WeaponAcquisitionI18nEntry>,
  categoryId: string,
  sourceId: string,
  name: LocalizedText,
  description: LocalizedText | undefined,
  warnings: string[],
 ): void {
  const key = `${categoryId}\u0000${sourceId}`
  const next = { source: { categoryId, sourceId }, name, ...(description ? { description } : {}) }
  const existing = details.get(key)
  if (existing && JSON.stringify(existing) !== JSON.stringify(next)) warnings.push(`Conflicting acquisition source content: ${categoryId}/${sourceId}`)
  if (!existing) details.set(key, next)
}

function sourceCategory(obtainWayId: string): string {
  if (CATEGORY_BY_OBTAIN_WAY[obtainWayId]) return CATEGORY_BY_OBTAIN_WAY[obtainWayId]
  if (/gacha|ticket/i.test(obtainWayId)) return 'gacha'
  if (/bp|battle.?pass/i.test(obtainWayId)) return 'battlePass'
  if (/shop|pay/i.test(obtainWayId)) return 'shop'
  if (/activity|event/i.test(obtainWayId)) return 'activity'
  if (/explore|gather/i.test(obtainWayId)) return 'explore'
  return 'unknown'
}
function isLocalizedText(value: TextRef | LocalizedText): value is LocalizedText {
  return 'zh-CN' in value
}

function localizedRef(ref: TextRef | LocalizedText | undefined, textTables: WikiTextTables, fallback: string): LocalizedText {
  if (ref && isLocalizedText(ref)) return ref
  const id = textRefId(ref)
  return id ? localizeWikiText(ref, textTables) : fallbackText(fallback)
}

function mergeLocalizedText(values: LocalizedText[], fallback: string): LocalizedText {
  if (values.length === 0) return fallbackText(fallback)
  return Object.fromEntries(LOCALES.map((locale) => [
    locale,
    [...new Set(values.map((value) => value[locale]).filter(Boolean))].join(' / ') || fallback,
  ])) as LocalizedText
}

function rewardWeaponIds(reward: RewardRecord | undefined, weaponIds: ReadonlySet<string>): string[] {
  if (!reward) return []
  const bundles = [...(reward.itemBundles ?? []), ...(reward.probItemBundles ?? [])]
  return [...new Set(bundles.map((bundle) => bundle.id).filter((id): id is string => Boolean(id && weaponIds.has(id))))]
}

export function buildWeaponAcquisitionData(akedataPath: string): WeaponAcquisitionData {
  const textTables = loadAllTextTables(akedataPath)
  const itemTable = table<ItemRecord>(akedataPath, 'ItemTable')
  const weaponBasic = table<Record<string, unknown>>(akedataPath, 'WeaponBasicTable')
  const systemJump = table<SystemJumpRecord>(akedataPath, 'SystemJumpTable')
  const gachaPools = table<GachaPoolRecord>(akedataPath, 'GachaWeaponPoolTable')
  const gachaContents = table<GachaPoolContentRecord>(akedataPath, 'GachaWeaponPoolContentTable')
  const shopGoods = table<ShopGoodsRecord>(akedataPath, 'ShopGoodsTable')
  const shopTable = table<ShopRecord>(akedataPath, 'ShopTable')
  const shopGroups = table<ShopGroupRecord>(akedataPath, 'ShopGroupTable')
  const rewards = table<RewardRecord>(akedataPath, 'RewardTable')
  const chests = table<ChestRecord>(akedataPath, 'UsableItemChestTable')
  const weaponIds = new Set(Object.keys(weaponBasic).filter((id) => id.startsWith('wpn_')))
  const sourceSets = new Map<string, Set<string>>()
  const details = new Map<string, WeaponAcquisitionI18nEntry>()
  const categories: Record<string, LocalizedText> = {}
  const warnings: string[] = []

  const ensureCategory = (categoryId: string, obtainWayId?: string) => {
    if (categories[categoryId]) return
    const system = obtainWayId ? systemJump[obtainWayId] : undefined
    categories[categoryId] = CATEGORY_FALLBACKS[categoryId] ?? (system?.desc
      ? localizedRef(system.desc, textTables, categoryId)
      : fallbackText(categoryId))
  }

  const ensureDetail = (categoryId: string, sourceId: string, name?: TextRef | LocalizedText, description?: TextRef | LocalizedText) => {
    ensureCategory(categoryId)
    const localizedName = localizedRef(name, textTables, sourceId)
    if (Object.values(localizedName).every((value) => value === sourceId)) {
      warnings.push(`Missing acquisition source name: ${categoryId}/${sourceId}`)
    }
    addDetail(
      details,
      categoryId,
      sourceId,
      localizedName,
      description ? localizedRef(description, textTables, '') : undefined,
      warnings,
    )
  }
  const localizedWeaponName = (ids: readonly string[]): LocalizedText | undefined => {
    const refs = ids.flatMap((id) => {
      const name = itemTable[id]?.name
      return name && textRefId(name) ? [name] : []
    })
    return refs.length > 0
      ? mergeLocalizedText(refs.map((ref) => localizedRef(ref, textTables, '')), '')
      : undefined
  }

  for (const weaponId of weaponIds) {
    const item = itemTable[weaponId]
    for (const rawWay of Array.isArray(item?.obtainWayIds) ? item.obtainWayIds : []) {
      if (typeof rawWay !== 'string') continue
      if (IGNORED_OBTAIN_WAYS.has(rawWay)) continue
      const categoryId = sourceCategory(rawWay)
      if (categoryId === 'unknown') warnings.push(`Unknown acquisition category: ${rawWay}`)
      addSource(sourceSets, weaponId, categoryId, rawWay)
      ensureCategory(categoryId, rawWay)
      const jump = systemJump[rawWay]
      ensureDetail(categoryId, rawWay, jump?.desc)
      if (!jump) warnings.push(`Unknown obtain way: ${rawWay}`)
    }
  }

  for (const [poolId, content] of Object.entries(gachaContents)) {
    const pool = gachaPools[poolId]
    const members = content.list?.map((entry) => entry.itemId).filter((id): id is string => Boolean(id && weaponIds.has(id))) ?? []
    if (members.length === 0) continue
    for (const weaponId of members) addSource(sourceSets, weaponId, 'gacha', poolId)
    ensureCategory('gacha', 'item_obtain_gacha')
    ensureDetail('gacha', poolId, pool?.name, pool?.loopRewardShowTitle)
    if (!pool) warnings.push(`Gacha content has no pool metadata: ${poolId}`)
  }

  for (const [goodsId, goods] of Object.entries(shopGoods)) {
    // Only direct weapon sales become shop sources. Goods that merely grant
    // gacha-pool access duplicate the weapon's gacha source (same pool, same
    // content) and are skipped to avoid a redundant "shop" record.
    if (goods.weaponGachaPoolId || goods.relatedWeaponGachPoolId) continue
    const rewardWeapons = rewardWeaponIds(rewards[goods.rewardId ?? ''], weaponIds)
    if (rewardWeapons.length === 0) continue
    const shop = goods.shopId ? shopTable[goods.shopId] : undefined
    const shopGroup = shop?.shopGroupId ? shopGroups[shop.shopGroupId] : undefined
    const shopName = shopGroup?.shopGroupName ?? shop?.shopName
    for (const weaponId of rewardWeapons) addSource(sourceSets, weaponId, 'shop', goodsId)
    ensureCategory('shop', 'item_obtain_payshop_weapon')
    ensureDetail(
      'shop',
      goodsId,
      localizedWeaponName(rewardWeapons) ?? shopName,
      shopName,
    )
  }

  // Merge shop sources that display identically for a weapon: the daily and
  // weekly armory exchanges sell the same weapon under different goodsIds
  // but share the "weapon name / 武库交易所" text, which would otherwise
  // render as duplicate cards. First occurrence wins.
  const seenShopTexts = new Set<string>()
  for (const values of sourceSets.values()) {
    seenShopTexts.clear()
    for (const key of values) {
      const separator = key.indexOf('\u0000')
      if (key.slice(0, separator) !== 'shop') continue
      const name = details.get(key)?.name
      const description = details.get(key)?.description
      const displayKey = JSON.stringify([name, description])
      if (seenShopTexts.has(displayKey)) {
        values.delete(key)
        continue
      }
      seenShopTexts.add(displayKey)
    }
  }

  for (const [chestId, chest] of Object.entries(chests)) {
    const directWeapons = (chest.randomChestItemIds ?? []).filter((id): id is string => weaponIds.has(id))
    const rewardWeapons = (chest.rewardIdList ?? []).flatMap((rewardId) => rewardWeaponIds(rewards[rewardId], weaponIds))
    const members = [...new Set([...directWeapons, ...rewardWeapons])]
    for (const weaponId of new Set(members)) {
      addSource(sourceSets, weaponId, 'chest', chestId)
      ensureCategory('chest')
      ensureDetail('chest', chestId, itemTable[chestId]?.name, itemTable[chestId]?.desc)
    }
  }

  const sourcesByWeapon: WeaponAcquisitionSourceMap = {}
  for (const weaponId of weaponIds) {
    const sources = [...(sourceSets.get(weaponId) ?? [])].map((key) => {
      const separator = key.indexOf('\u0000')
      return { categoryId: key.slice(0, separator), sourceId: key.slice(separator + 1) }
    })
    sourcesByWeapon[weaponId] = sources
    if (sources.length === 0) warnings.push(`Weapon has no acquisition source: ${weaponId}`)
  }

  return {
    sourcesByWeapon,
    categories,
    details: Object.fromEntries(details),
    warnings: [...new Set(warnings)],
  }
}

export function acquisitionDetailKey(categoryId: string, sourceId: string): string {
  return `${categoryId}\u0000${sourceId}`
}
