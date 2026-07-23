import { expect, it } from 'vitest'
import { hasGameI18n, lookupGameI18n, getGameI18nCatalog } from './game-i18n-catalogs'

it('loads generated catalogs for supported locales', () => {
  const catalog = getGameI18nCatalog('en', 'wikiData')
  expect(Object.keys(catalog).length).toBeGreaterThan(100)
  expect(hasGameI18n('en', 'wikiData', 'enum|attributes|0')).toBe(true)
  expect(lookupGameI18n('en', 'wikiData', 'enum|attributes|0')).toBeTruthy()
})

it('returns undefined for missing keys without throwing', () => {
  expect(hasGameI18n('zh-CN', 'characters', 'definitely-missing-id')).toBe(false)
  expect(lookupGameI18n('zh-CN', 'characters', 'definitely-missing-id')).toBeUndefined()
})
