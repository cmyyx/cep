import { expect, it } from 'vitest'
import {
  loadClientMessages,
  loadMessages,
  loadPlannerCatalogs,
  loadPlannerClientMessages,
  loadRouteShellMessages,
} from './load-messages'
import routeShellMessages from './route-shell-messages.json'

it('client messages are the core shell only: global namespaces + key-level picks', () => {
  for (const locale of ['zh-CN', 'zh-TW', 'ja', 'en'] as const) {
    const messages = loadClientMessages(locale) as Record<string, Record<string, unknown>>
    // 路由级命名空间不允许出现在核心包
    for (const routeOnly of ['settings', 'auth', 'legal', 'meta', 'about', 'essence', 'refinement', 'wikiData', 'weapons', 'equips']) {
      expect(messages, `core bag must not contain "${routeOnly}" (${locale})`).not.toHaveProperty(routeOnly)
    }
    // 全局命名空间完整保留
    expect(messages).toHaveProperty('nav')
    expect(messages).toHaveProperty('legacyMigration')
    // key 级子集: 仅全局用到的 key
    expect(Object.keys(messages.account).sort()).toEqual(
      [...routeShellMessages.corePicks.account].sort(),
    )
    expect(Object.keys(messages.home).sort()).toEqual(
      [...routeShellMessages.corePicks.home].sort(),
    )
    expect(Object.keys(messages.wiki)).toEqual(['categories'])
    expect(messages.backgroundPreview).toHaveProperty('dailyUpdatedBadge')
    expect(Object.keys(messages.backgroundPreview)).toHaveLength(1)
  }
})

it('route shell messages resolve namespaces and picks per route', () => {
  const home = loadRouteShellMessages('zh-CN', '(home)') as Record<string, Record<string, unknown>>
  expect(home).toHaveProperty('home')
  expect(Object.keys(home.about).sort()).toEqual(
    ['bannerCalendarDesc', 'essencePlannerDesc', 'refinementPlannerDesc'].sort(),
  )
  expect(Object.keys(home.meta).sort()).toEqual(
    ['growthPlannerDescription', 'homeDescription', 'panelPreviewDescription'].sort(),
  )

  const wiki = loadRouteShellMessages('ja', 'wiki') as Record<string, Record<string, unknown>>
  expect(wiki).toHaveProperty('wiki')
  expect(Object.keys(wiki.refinement).sort()).toEqual(
    ['modelTypeI', 'modelTypeII', 'modelTypeIII'].sort(),
  )

  const login = loadRouteShellMessages('en', 'login') as Record<string, unknown>
  expect(login).toHaveProperty('auth')
  expect(login).toHaveProperty('account')
})

it('route catalogs listed in route-shell-messages.json stay in sync with planner profiles', () => {
  const routes = routeShellMessages.routes as Record<
    string,
    { catalogs?: readonly string[] }
  >
  expect(routes['essence-planner'].catalogs?.slice().sort()).toEqual(
    Object.keys(loadPlannerCatalogs('zh-CN', 'essence')).sort(),
  )
  expect(routes['refinement-planner'].catalogs?.slice().sort()).toEqual(
    Object.keys(loadPlannerCatalogs('zh-CN', 'refinement')).sort(),
  )
  expect(routes['account'].catalogs?.slice().sort()).toEqual(
    Object.keys(loadPlannerCatalogs('zh-CN', 'account')).sort(),
  )
  expect(routes['panel-preview'].catalogs?.slice().sort()).toEqual(
    Object.keys(loadPlannerCatalogs('zh-CN', 'panel-preview')).sort(),
  )
})

it('planner catalogs can be sliced per route profile', () => {
  const essence = loadPlannerCatalogs('zh-CN', 'essence') as Record<string, unknown>
  expect(essence).toHaveProperty('weapons')
  expect(essence).toHaveProperty('dungeons')
  expect(essence).toHaveProperty('gemStats')
  expect(essence).toHaveProperty('weaponStats')
  expect(essence).toHaveProperty('region')
  expect(essence).not.toHaveProperty('equips')
  expect(essence).not.toHaveProperty('nav')
  expect(essence).not.toHaveProperty('wikiData')

  const refinement = loadPlannerCatalogs('zh-CN', 'refinement') as Record<string, unknown>
  expect(refinement).toHaveProperty('equips')
  expect(refinement).toHaveProperty('suits')
  expect(refinement).not.toHaveProperty('weapons')
  expect(refinement).not.toHaveProperty('dungeons')

  const account = loadPlannerCatalogs('en', 'account') as Record<string, unknown>
  expect(Object.keys(account).sort()).toEqual(['equips', 'region'])

  // Panel preview needs weaponStats so weaponStatLabel() can resolve
  // weapon attribute ids (gat_passive_attr_*, gst_passive_*) via t('weaponStats.<id>').
  const panelPreview = loadPlannerCatalogs('zh-CN', 'panel-preview') as Record<string, unknown>
  expect(Object.keys(panelPreview).sort()).toEqual(['weaponStats'])
})

it('planner client messages include shell + selected catalogs but not wikiData', () => {
  const messages = loadPlannerClientMessages('en', 'essence') as Record<string, unknown>
  expect(messages).toHaveProperty('nav')
  expect(messages).toHaveProperty('weapons')
  expect(messages).not.toHaveProperty('equips')
  expect(messages).not.toHaveProperty('wikiData')
})

it('server messages include wikiData for the selected locale', () => {
  const en = loadMessages('en') as Record<string, unknown>
  expect(en).toHaveProperty('wikiData')
  expect(en.wikiData).toBeTruthy()
  expect(typeof en.wikiData).toBe('object')
  expect(Object.keys(en.wikiData as object).length).toBeGreaterThan(100)

  const zh = loadMessages('zh-CN') as Record<string, unknown>
  expect(zh).toHaveProperty('wikiData')
  // Different locale catalogs are distinct objects (not accidentally sharing client-only bags).
  expect(zh.wikiData).not.toBe(en.wikiData)
  // Full server bag still has all planner tables for SSG t().
  expect(zh).toHaveProperty('equips')
  expect(zh).toHaveProperty('weapons')
})
