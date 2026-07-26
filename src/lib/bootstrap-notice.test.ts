// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  isNoticeVisibleForLocale,
  parseBootstrapNotice,
  parseBootstrapPayload,
  pickLocalizedText,
  sanitizeNoticeUrl,
} from './bootstrap-notice'

const fullNotice = {
  id: 12,
  level: 'critical',
  title: { 'zh-CN': '维护中', 'zh-TW': '維護中', ja: 'メンテナンス中', en: 'Maintenance' },
  body: { 'zh-CN': '正文', 'zh-TW': '', ja: '本文', en: 'Body' },
  linkUrl: 'https://end.canmoe.com/status',
  linkLabel: { 'zh-CN': '查看', en: 'Check' },
  dismissible: false,
  updatedAt: '2026-07-26T00:00:00Z',
}

describe('parseBootstrapPayload', () => {
  it('keeps every contract field of a well-formed payload', () => {
    const payload = parseBootstrapPayload({ notice: fullNotice, serverTime: '2026-07-26T00:00:00Z' })
    expect(payload?.serverTime).toBe('2026-07-26T00:00:00Z')
    expect(payload?.notice).toEqual({
      id: 12,
      level: 'critical',
      title: fullNotice.title,
      // 空串被剔除, 避免回退链取到空文案
      body: { 'zh-CN': '正文', ja: '本文', en: 'Body' },
      linkUrl: 'https://end.canmoe.com/status',
      linkLabel: { 'zh-CN': '查看', en: 'Check' },
      // 后端仍可能带 dismissible, 但横幅不可关闭, 解析结果刻意不含该字段
      updatedAt: '2026-07-26T00:00:00Z',
    })
  })

  it('returns null for non-object payloads', () => {
    expect(parseBootstrapPayload(undefined)).toBeNull()
    expect(parseBootstrapPayload('boom')).toBeNull()
    expect(parseBootstrapPayload(['boom'])).toBeNull()
    expect(parseBootstrapPayload(null)).toBeNull()
  })

  it('drops malformed notices but still yields a payload', () => {
    expect(parseBootstrapPayload({ notice: null }))
      .toEqual({ notice: null, serverTime: undefined })
    expect(parseBootstrapPayload({ notice: {} })?.notice).toBeNull()
    expect(parseBootstrapPayload({ notice: { id: '12', title: { en: 'x' } } })?.notice).toBeNull()
    expect(parseBootstrapPayload({ notice: { id: 1, title: 'x' } })?.notice).toBeNull()
    expect(parseBootstrapPayload({ notice: { id: 1, title: { fr: 'x' } } })?.notice).toBeNull()
    expect(parseBootstrapPayload({ notice: { id: Number.NaN, title: { en: 'x' } } })?.notice).toBeNull()
  })

  it('ignores non-string serverTime', () => {
    expect(parseBootstrapPayload({ notice: null, serverTime: 123 })?.serverTime).toBeUndefined()
  })
})

describe('parseBootstrapNotice', () => {
  it('falls back to info for unknown levels and leaves optional fields empty', () => {
    const notice = parseBootstrapNotice({ id: 3, level: 'nuclear', title: { en: 'hi' } })
    expect(notice?.level).toBe('info')
    expect(notice?.body).toEqual({})
    expect(notice?.linkUrl).toBeUndefined()
    expect(notice?.updatedAt).toBeUndefined()
  })

  it('ignores a dismissible flag from the backend (the banner is never closable)', () => {
    const notice = parseBootstrapNotice({ id: 3, title: { en: 'hi' }, dismissible: false })
    expect(notice).not.toBeNull()
    expect(notice).not.toHaveProperty('dismissible')
  })
})

describe('notice locale targeting', () => {
  function parseLocales(locales: unknown) {
    return parseBootstrapNotice({ id: 1, title: { en: 'hi' }, locales })?.locales
  }

  it('keeps a non-empty string array and trims its entries', () => {
    expect(parseLocales(['zh-CN', ' ja '])).toEqual(['zh-CN', 'ja'])
    // 未知取值保留原样: 白名单过滤会把它变成空数组 = 对所有人展示, 那是更糟的失败方向
    expect(parseLocales(['fr'])).toEqual(['fr'])
    expect(parseLocales(['zh-CN', 7, null, '   '])).toEqual(['zh-CN'])
  })

  it('treats a missing, null, empty or non-array field as "all locales"', () => {
    expect(parseLocales(undefined)).toBeUndefined()
    expect(parseLocales(null)).toBeUndefined()
    expect(parseLocales([])).toBeUndefined()
    expect(parseLocales('zh-CN')).toBeUndefined()
    expect(parseLocales([7, null])).toBeUndefined()
    expect(parseBootstrapNotice({ id: 1, title: { en: 'hi' } })?.locales).toBeUndefined()
  })

  it('renders for every locale when the notice is not targeted', () => {
    expect(isNoticeVisibleForLocale({}, 'zh-CN')).toBe(true)
    expect(isNoticeVisibleForLocale({ locales: undefined }, 'ja')).toBe(true)
    expect(isNoticeVisibleForLocale({ locales: [] }, 'ja')).toBe(true)
  })

  it('renders only for the targeted locales', () => {
    expect(isNoticeVisibleForLocale({ locales: ['ja', 'en'] }, 'ja')).toBe(true)
    expect(isNoticeVisibleForLocale({ locales: ['ja', 'en'] }, 'zh-CN')).toBe(false)
    expect(isNoticeVisibleForLocale({ locales: ['fr'] }, 'en')).toBe(false)
    // 精确匹配: 不做语言前缀推断, 定向 zh-CN 不会命中 zh-TW
    expect(isNoticeVisibleForLocale({ locales: ['zh-CN'] }, 'zh-TW')).toBe(false)
  })
})

describe('sanitizeNoticeUrl', () => {
  it('allows http(s) and site-absolute paths', () => {
    expect(sanitizeNoticeUrl('https://a.example/x')).toBe('https://a.example/x')
    expect(sanitizeNoticeUrl('http://a.example/x')).toBe('http://a.example/x')
    expect(sanitizeNoticeUrl('/zh-CN/about')).toBe('/zh-CN/about')
  })

  it('rejects dangerous or unusable values', () => {
    expect(sanitizeNoticeUrl('javascript:alert(1)')).toBeUndefined()
    expect(sanitizeNoticeUrl('data:text/html,<script>')).toBeUndefined()
    expect(sanitizeNoticeUrl('//evil.example')).toBeUndefined()
    expect(sanitizeNoticeUrl('not a url')).toBeUndefined()
    expect(sanitizeNoticeUrl('   ')).toBeUndefined()
    expect(sanitizeNoticeUrl(42)).toBeUndefined()
    expect(sanitizeNoticeUrl(null)).toBeUndefined()
  })
})

describe('pickLocalizedText', () => {
  it('prefers current locale, then zh-CN, then en', () => {
    expect(pickLocalizedText({ ja: 'JA', 'zh-CN': 'CN', en: 'EN' }, 'ja')).toBe('JA')
    expect(pickLocalizedText({ 'zh-CN': 'CN', en: 'EN' }, 'ja')).toBe('CN')
    expect(pickLocalizedText({ en: 'EN' }, 'ja')).toBe('EN')
    expect(pickLocalizedText({}, 'ja')).toBeUndefined()
    expect(pickLocalizedText({ 'zh-TW': 'TW' }, 'ja')).toBeUndefined()
  })
})
