import { describe, it, expect } from 'vitest'
import { GUARD_ENVIRONMENT_LABELS } from '@/components/shared/guard-layout'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import zhCN from '@/messages/zh-CN.json'
import zhTW from '@/messages/zh-TW.json'

/**
 * Drift guard.
 *
 * GUARD_ENVIRONMENT_LABELS is intentionally inlined instead of importing
 * messages/*.json — a static JSON import pulled all four full catalogs
 * (240 KB) into the critical path of every page for six keys. The tradeoff is
 * that the two copies can now diverge silently, so this test pins them
 * together: editing messages/*.json without updating guard-layout.tsx fails
 * here instead of shipping an untranslated guard overlay.
 */

const SOURCES = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  en,
} as const

describe('GUARD_ENVIRONMENT_LABELS', () => {
  it('matches messages/*.json for every locale and key', () => {
    for (const [locale, messages] of Object.entries(SOURCES)) {
      const expected = {
        browser: messages.environment.browser,
        engine: messages.environment.engine,
        version: messages.version.version,
        commits: messages.version.commitCount,
        commitTime: messages.version.commitTime,
        buildTime: messages.version.buildTime,
      }
      expect(
        GUARD_ENVIRONMENT_LABELS[locale as keyof typeof GUARD_ENVIRONMENT_LABELS],
        `locale ${locale}`,
      ).toEqual(expected)
    }
  })

  it('covers exactly the four locale routes', () => {
    expect(Object.keys(GUARD_ENVIRONMENT_LABELS).sort()).toEqual(['en', 'ja', 'zh-CN', 'zh-TW'])
  })

  it('has no empty label (an empty string would render a blank guard row)', () => {
    for (const [locale, labels] of Object.entries(GUARD_ENVIRONMENT_LABELS)) {
      for (const [key, value] of Object.entries(labels)) {
        expect(value, `${locale}.${key}`).not.toBe('')
      }
    }
  })
})
