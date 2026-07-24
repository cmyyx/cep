import { afterEach, expect, it } from 'vitest'
import {
  getCachedGameI18nLocale,
  hasGameI18n,
  loadGameI18nLocale,
  lookupGameI18n,
  resetGameI18nCatalogCacheForTests,
} from './game-i18n-catalogs'

afterEach(() => {
  resetGameI18nCatalogCacheForTests()
})

it('loads a single locale bundle and caches it', async () => {
  expect(getCachedGameI18nLocale('en')).toBeUndefined()
  const bundle = await loadGameI18nLocale('en')
  expect(Object.keys(bundle.wikiData).length).toBeGreaterThan(100)
  expect(getCachedGameI18nLocale('en')).toBe(bundle)
  expect(hasGameI18n('en', 'wikiData', 'enum|attributes|0')).toBe(true)
  expect(lookupGameI18n('en', 'wikiData', 'enum|attributes|0')).toBeTruthy()
  // Second call hits cache
  await expect(loadGameI18nLocale('en')).resolves.toBe(bundle)
})

it('returns undefined for missing keys without throwing', async () => {
  await loadGameI18nLocale('zh-CN')
  expect(hasGameI18n('zh-CN', 'characters', 'definitely-missing-id')).toBe(false)
  expect(lookupGameI18n('zh-CN', 'characters', 'definitely-missing-id')).toBeUndefined()
})

it('does not load other locales when one locale is requested', async () => {
  await loadGameI18nLocale('ja')
  expect(getCachedGameI18nLocale('ja')).toBeTruthy()
  expect(getCachedGameI18nLocale('en')).toBeUndefined()
  expect(getCachedGameI18nLocale('zh-CN')).toBeUndefined()
})
