import { expect, it } from 'vitest'
import { asWikiLocale } from './wiki-locale'

it('accepts supported locales unchanged', () => {
  expect(asWikiLocale('en')).toBe('en')
  expect(asWikiLocale('ja')).toBe('ja')
  expect(asWikiLocale('zh-CN')).toBe('zh-CN')
  expect(asWikiLocale('zh-TW')).toBe('zh-TW')
})

it('falls back unknown locales to zh-CN', () => {
  expect(asWikiLocale('fr')).toBe('zh-CN')
  expect(asWikiLocale('')).toBe('zh-CN')
  expect(asWikiLocale('zh')).toBe('zh-CN')
  expect(asWikiLocale('EN')).toBe('zh-CN')
})
