import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { buildWeaponAcquisitionData } from './weapon-acquisition'

const tempRoots: string[] = []

function fixtureRoot(): string {
  const root = join(process.cwd(), '.tmp-weapon-acquisition-test')
  rmSync(root, { recursive: true, force: true })
  mkdirSync(join(root, 'TableCfg'), { recursive: true })
  tempRoots.push(root)
  return root
}

function writeTable(root: string, name: string, value: unknown): void {
  writeFileSync(join(root, 'TableCfg', `${name}.json`), `${JSON.stringify(value)}\n`, 'utf8')
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

it('normalizes direct, pool, shop, and chest sources without localized fields', () => {
  const root = fixtureRoot()
  const textIds = {
    '1': '活动来源',
    '2': '常驻武器池',
    '3': '日常武器商店',
  }
  for (const locale of ['CN', 'EN', 'JP', 'TC']) writeTable(root, `I18nTextTable_${locale}`, textIds)

  writeTable(root, 'WeaponBasicTable', {
    wpn_test: { rarity: 5 },
  })
  writeTable(root, 'ItemTable', {
    wpn_test: { obtainWayIds: ['item_obtain_activity'] },
  })
  writeTable(root, 'SystemJumpTable', {
    item_obtain_activity: { desc: { id: 1 } },
  })
  writeTable(root, 'GachaWeaponPoolTable', {
    pool_test: { name: { id: 2 } },
  })
  writeTable(root, 'GachaWeaponPoolContentTable', {
    pool_test: { list: [{ itemId: 'wpn_test' }] },
  })
  writeTable(root, 'ShopGoodsTable', {
    goods_test: { shopId: 'shop_test', rewardId: 'reward_test' },
  })
  writeTable(root, 'ShopTable', {
    shop_test: { shopName: { id: 3 } },
  })
  writeTable(root, 'RewardTable', {
    reward_test: { itemBundles: [{ id: 'wpn_test' }] },
  })
  writeTable(root, 'UsableItemChestTable', {
    chest_test: { rewardIdList: ['reward_test'] },
    chest_direct: { randomChestItemIds: ['wpn_test'] },
  })

  const result = buildWeaponAcquisitionData(root)
  expect(result.sourcesByWeapon.wpn_test).toEqual(expect.arrayContaining([
    { categoryId: 'activity', sourceId: 'item_obtain_activity' },
    { categoryId: 'gacha', sourceId: 'pool_test' },
    { categoryId: 'shop', sourceId: 'goods_test' },
    { categoryId: 'chest', sourceId: 'chest_test' },
    { categoryId: 'chest', sourceId: 'chest_direct' },
  ]))
  // RewardTable entries alone must NOT become acquisition sources — every
  // weapon shows up in countless rewards and the category is pure noise.
  expect(result.sourcesByWeapon.wpn_test).not.toContainEqual({ categoryId: 'reward', sourceId: 'reward_test' })
  expect(result.sourcesByWeapon.wpn_test.every((source) => Object.keys(source).sort().join(',') === 'categoryId,sourceId')).toBe(true)
  expect(result.details['gacha\u0000pool_test']?.name['zh-CN']).toBe('常驻武器池')
  expect(result.details['shop\u0000goods_test']?.name['zh-CN']).toBe('日常武器商店')
})

it('resolves concrete shop names through their owning records', () => {
  const root = fixtureRoot()
  const textIds = {
    '10': '测试武器',
    '11': '测试武器池',
    '12': '测试池赠礼',
    '13': '武库交易所',
  }
  for (const locale of ['CN', 'EN', 'JP', 'TC']) writeTable(root, `I18nTextTable_${locale}`, textIds)
  writeTable(root, 'WeaponBasicTable', { wpn_test: { rarity: 5 } })
  writeTable(root, 'ItemTable', {
    wpn_test: { name: { id: 10 }, obtainWayIds: [] },
  })
  writeTable(root, 'GachaWeaponPoolTable', { pool_test: { name: { id: 11 }, loopRewardShowTitle: { id: 12 } } })
  writeTable(root, 'GachaWeaponPoolContentTable', { pool_test: { list: [{ itemId: 'wpn_test' }] } })
  writeTable(root, 'ShopGoodsTable', {
    // Pool access goods duplicate the weapon's gacha source — no shop source.
    goods_pool: { shopId: 'shop_test', weaponGachaPoolId: 'pool_test' },
    // Direct weapon sale stays a shop source.
    goods_direct: { shopId: 'shop_test', rewardId: 'reward_test' },
  })
  writeTable(root, 'ShopTable', { shop_test: { shopGroupId: 'shop_group_test' } })
  writeTable(root, 'ShopGroupTable', { shop_group_test: { shopGroupName: { id: 13 } } })
  writeTable(root, 'RewardTable', {
    reward_test: { itemBundles: [{ id: 'wpn_test' }] },
  })
  writeTable(root, 'UsableItemChestTable', {})

  const result = buildWeaponAcquisitionData(root)
  expect(result.sourcesByWeapon.wpn_test).not.toContainEqual({ categoryId: 'shop', sourceId: 'goods_pool' })
  expect(result.details['shop\u0000goods_direct']).toMatchObject({ name: { 'zh-CN': '测试武器' }, description: { 'zh-CN': '武库交易所' } })
})

it('merges shop sources with identical display text for one weapon', () => {
  const root = fixtureRoot()
  const textIds = { '10': '测试武器', '13': '武库交易所' }
  for (const locale of ['CN', 'EN', 'JP', 'TC']) writeTable(root, `I18nTextTable_${locale}`, textIds)
  writeTable(root, 'WeaponBasicTable', { wpn_test: { rarity: 5 } })
  writeTable(root, 'ItemTable', { wpn_test: { name: { id: 10 }, obtainWayIds: [] } })
  // Two armory goods (daily + weekly) with the same shop and weapon reward.
  writeTable(root, 'ShopGoodsTable', {
    goods_daily: { shopId: 'shop_test', rewardId: 'reward_daily' },
    goods_weekly: { shopId: 'shop_test', rewardId: 'reward_weekly' },
    goods_other_shop: { shopId: 'shop_other', rewardId: 'reward_other' },
  })
  writeTable(root, 'ShopTable', {
    shop_test: { shopGroupId: 'shop_group_test' },
    shop_other: { shopGroupId: 'shop_group_other' },
  })
  writeTable(root, 'ShopGroupTable', {
    shop_group_test: { shopGroupName: { id: 13 } },
    shop_group_other: { shopGroupName: { id: 13 } },
  })
  writeTable(root, 'RewardTable', {
    reward_daily: { itemBundles: [{ id: 'wpn_test' }] },
    reward_weekly: { itemBundles: [{ id: 'wpn_test' }] },
    reward_other: { itemBundles: [{ id: 'wpn_test' }] },
  })
  for (const table of ['SystemJumpTable', 'GachaWeaponPoolTable', 'GachaWeaponPoolContentTable', 'UsableItemChestTable']) writeTable(root, table, {})

  const result = buildWeaponAcquisitionData(root)
  // All three goods resolve to the same "测试武器 / 武库交易所" text — only the
  // first survives per weapon.
  const shopSources = result.sourcesByWeapon.wpn_test.filter((source) => source.categoryId === 'shop')
  expect(shopSources).toEqual([{ categoryId: 'shop', sourceId: 'goods_daily' }])
})

it('drops shared obtain-way entries and the gacha-pool duplication from shop sources', () => {
  const root = fixtureRoot()
  for (const locale of ['CN', 'EN', 'JP', 'TC']) writeTable(root, `I18nTextTable_${locale}`, {})
  writeTable(root, 'WeaponBasicTable', { wpn_test: { rarity: 5 } })
  writeTable(root, 'ItemTable', {
    wpn_test: { obtainWayIds: ['item_obtain_payshop_weapon', 'item_obtain_payshop_weapon_gift'] },
  })
  for (const table of ['SystemJumpTable', 'GachaWeaponPoolTable', 'GachaWeaponPoolContentTable', 'ShopGoodsTable', 'ShopTable', 'ShopGroupTable', 'RewardTable', 'UsableItemChestTable']) writeTable(root, table, {})

  const result = buildWeaponAcquisitionData(root)
  expect(result.sourcesByWeapon.wpn_test).toEqual([])
})

it('keeps an empty source list for a weapon with no discoverable acquisition record', () => {
  const root = fixtureRoot()
  for (const locale of ['CN', 'EN', 'JP', 'TC']) writeTable(root, `I18nTextTable_${locale}`, {})
  writeTable(root, 'WeaponBasicTable', { wpn_test: { rarity: 5 } })
  writeTable(root, 'ItemTable', { wpn_test: { obtainWayIds: [] } })
  for (const table of ['SystemJumpTable', 'GachaWeaponPoolTable', 'GachaWeaponPoolContentTable', 'ShopGoodsTable', 'ShopTable', 'RewardTable', 'UsableItemChestTable']) writeTable(root, table, {})

  const result = buildWeaponAcquisitionData(root)
  expect(result.sourcesByWeapon.wpn_test).toEqual([])
  expect(result.warnings).toContain('Weapon has no acquisition source: wpn_test')
})

it('warns when a referenced source has no display name', () => {
  const root = fixtureRoot()
  for (const locale of ['CN', 'EN', 'JP', 'TC']) writeTable(root, `I18nTextTable_${locale}`, {})
  writeTable(root, 'WeaponBasicTable', { wpn_test: { rarity: 5 } })
  writeTable(root, 'ItemTable', { wpn_test: { obtainWayIds: [] } })
  writeTable(root, 'GachaWeaponPoolContentTable', { pool_missing: { list: [{ itemId: 'wpn_test' }] } })
  for (const table of ['SystemJumpTable', 'GachaWeaponPoolTable', 'ShopGoodsTable', 'ShopTable', 'RewardTable', 'UsableItemChestTable']) writeTable(root, table, {})

  const result = buildWeaponAcquisitionData(root)
  expect(result.warnings).toContain('Missing acquisition source name: gacha/pool_missing')
})
