// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GameI18nCatalogPreloader } from './game-i18n-catalog-preloader'

const loadGameI18nLocale = vi.fn((_locale: string) => Promise.resolve({} as never))

vi.mock('@/lib/game-i18n-catalogs', () => ({
  loadGameI18nLocale: (locale: string) => loadGameI18nLocale(locale),
}))

vi.mock('@/lib/wiki-locale', () => ({
  asWikiLocale: (locale: string) =>
    locale === 'en' || locale === 'ja' || locale === 'zh-CN' || locale === 'zh-TW' ? locale : 'zh-CN',
}))

afterEach(() => {
  cleanup()
  loadGameI18nLocale.mockClear()
})

it('loads normalized locale catalogs on mount', () => {
  render(<GameI18nCatalogPreloader locale="en" />)
  expect(loadGameI18nLocale).toHaveBeenCalledTimes(1)
  expect(loadGameI18nLocale).toHaveBeenCalledWith('en')
})

it('reloads when locale changes and normalizes unknown locales', () => {
  const { rerender } = render(<GameI18nCatalogPreloader locale="ja" />)
  expect(loadGameI18nLocale).toHaveBeenLastCalledWith('ja')

  rerender(<GameI18nCatalogPreloader locale="fr" />)
  expect(loadGameI18nLocale).toHaveBeenLastCalledWith('zh-CN')
  expect(loadGameI18nLocale).toHaveBeenCalledTimes(2)
})
