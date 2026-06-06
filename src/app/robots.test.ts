import { describe, it, expect, afterEach } from 'vitest'
import robots from '@/app/robots'

describe('robots', () => {
  const originalSiteUrl = process.env.SITE_URL

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.SITE_URL
    } else {
      process.env.SITE_URL = originalSiteUrl
    }
  })

  it('returns rules with wildcard user-agent and allow /', () => {
    const result = robots()

    expect(result.rules).toBeDefined()
    if (typeof result.rules === 'object' && !Array.isArray(result.rules)) {
      expect(result.rules.userAgent).toBe('*')
      expect(result.rules.allow).toBe('/')
    }
  })

  it('returns a sitemap URL ending with /sitemap.xml', () => {
    const result = robots()

    expect(result.sitemap).toBeDefined()
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/)
  })

  it('always uses DEFAULT_SITE_URL regardless of env', () => {
    process.env.SITE_URL = 'https://custom.example.com'
    const result = robots()

    expect(result.sitemap).toBe('https://end.canmoe.com/sitemap.xml')
  })
})
