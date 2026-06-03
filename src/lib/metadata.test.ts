import { describe, it, expect, afterEach } from 'vitest'
import { routing } from '@/i18n/routing'
import { getAlternates } from '@/lib/metadata'
import { DEFAULT_SITE_URL } from '@/lib/constants'

const LOCALES = routing.locales
const DEFAULT_LOCALE = routing.defaultLocale

describe('getAlternates', () => {
  const originalSiteUrl = process.env.SITE_URL

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.SITE_URL
    } else {
      process.env.SITE_URL = originalSiteUrl
    }
  })

  it('returns canonical and languages for the given locale', () => {
    const result = getAlternates('zh-CN', 'essence-planner')

    expect(result.canonical).toBe(`${DEFAULT_SITE_URL}/zh-CN/essence-planner`)
    expect(result.languages).toBeDefined()
    expect(Object.keys(result.languages).length).toBe(LOCALES.length + 1) // +1 for x-default
  })

  it('includes all locales in languages map', () => {
    const result = getAlternates('en')

    for (const loc of LOCALES) {
      expect(result.languages[loc]).toBe(`${DEFAULT_SITE_URL}/${loc}`)
    }
  })

  it('includes x-default pointing to default locale', () => {
    const result = getAlternates('ja', 'about')

    expect(result.languages['x-default']).toBe(`${DEFAULT_SITE_URL}/${DEFAULT_LOCALE}/about`)
  })

  it('handles empty path (home page)', () => {
    const result = getAlternates('zh-CN')

    expect(result.canonical).toBe(`${DEFAULT_SITE_URL}/zh-CN`)
    for (const loc of LOCALES) {
      expect(result.languages[loc]).toBe(`${DEFAULT_SITE_URL}/${loc}`)
    }
  })

  it('handles non-empty path', () => {
    const result = getAlternates('en', 'refinement-planner')

    expect(result.canonical).toBe(`${DEFAULT_SITE_URL}/en/refinement-planner`)
    expect(result.languages['zh-CN']).toBe(`${DEFAULT_SITE_URL}/zh-CN/refinement-planner`)
  })

  it('strips trailing slash from SITE_URL', () => {
    process.env.SITE_URL = 'https://trailing.example.com/'
    const result = getAlternates('zh-CN')

    expect(result.canonical).toBe('https://trailing.example.com/zh-CN')
  })

  it('uses DEFAULT_SITE_URL when SITE_URL is not set', () => {
    delete process.env.SITE_URL
    const result = getAlternates('ja')

    expect(result.canonical).toBe(`${DEFAULT_SITE_URL}/ja`)
  })
})
