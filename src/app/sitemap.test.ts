import { describe, it, expect, afterEach } from 'vitest'
import { routing } from '@/i18n/routing'
import sitemap from '@/app/sitemap'

const DEFAULT_LOCALE = routing.defaultLocale
const LOCALES = routing.locales

describe('sitemap', () => {
  const originalSiteUrl = process.env.SITE_URL

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.SITE_URL
    } else {
      process.env.SITE_URL = originalSiteUrl
    }
  })

  it('returns an array with one entry per route', () => {
    const result = sitemap()
    expect(Array.isArray(result)).toBe(true)
    // ROUTES has 15 entries
    expect(result.length).toBe(15)
  })

  it('each entry has url, lastModified, changeFrequency, priority, alternates', () => {
    const result = sitemap()
    for (const entry of result) {
      expect(typeof entry.url).toBe('string')
      expect(entry.lastModified).toBeInstanceOf(Date)
      expect(entry.changeFrequency).toBeDefined()
      expect(typeof entry.priority).toBe('number')
      expect(entry.alternates).toBeDefined()
      expect(entry.alternates?.languages).toBeDefined()
    }
  })

  it('home entry (empty path) has correct url and alternates', () => {
    const result = sitemap()
    const home = result.find((e) => e.url.endsWith(`/${DEFAULT_LOCALE}`) && !e.url.includes(`/${DEFAULT_LOCALE}/`))
    expect(home).toBeDefined()
    expect(home!.url).toBe(`https://end.canmoe.com/${DEFAULT_LOCALE}`)

    const langs = home!.alternates!.languages!
    for (const loc of LOCALES) {
      expect(langs[loc]).toBe(`https://end.canmoe.com/${loc}`)
    }
    expect(langs['x-default']).toBe(`https://end.canmoe.com/${DEFAULT_LOCALE}`)
  })

  it('non-empty path entry has correct url and alternates', () => {
    const result = sitemap()
    const planner = result.find((e) => e.url.includes('essence-planner'))
    expect(planner).toBeDefined()
    expect(planner!.url).toBe(`https://end.canmoe.com/${DEFAULT_LOCALE}/essence-planner`)

    const langs = planner!.alternates!.languages!
    for (const loc of LOCALES) {
      expect(langs[loc]).toBe(`https://end.canmoe.com/${loc}/essence-planner`)
    }
    expect(langs['x-default']).toBe(`https://end.canmoe.com/${DEFAULT_LOCALE}/essence-planner`)
  })

  it('uses SITE_URL env var when set', () => {
    process.env.SITE_URL = 'https://custom.example.com'
    const result = sitemap()
    const home = result.find((e) => e.url === `https://custom.example.com/${DEFAULT_LOCALE}`)
    expect(home).toBeDefined()
  })
})
