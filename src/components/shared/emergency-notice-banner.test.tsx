// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import {
  NOTICE_POLL_ENDPOINT,
  NOTICE_POLL_INTERVAL_MS,
  ingestNoticePayload,
  resetNoticeStoreForTests,
} from '@/lib/notice-store'
import { EmergencyNoticeBanner } from './emergency-notice-banner'

let mockLocale = 'zh-CN'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => mockLocale,
}))

function makeNotice(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    level: 'warning',
    title: { 'zh-CN': '服务维护', 'zh-TW': '服務維護', ja: 'メンテナンス', en: 'Maintenance' },
    body: { 'zh-CN': '预计一小时', 'zh-TW': '', ja: '', en: 'About one hour' },
    linkUrl: null,
    linkLabel: null,
    updatedAt: '2026-07-26T00:00:00Z',
    ...overrides,
  }
}

function banner() {
  return document.querySelector('[data-level]')
}

function stubPoll(payload: unknown, init: { ok?: boolean; throws?: boolean } = {}) {
  const fetchMock = vi.fn(async () => {
    if (init.throws) throw new Error('offline')
    return { ok: init.ok ?? true, json: async () => payload }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function flushFetch() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('EmergencyNoticeBanner', () => {
  beforeEach(() => {
    cleanup()
    resetNoticeStoreForTests()
    mockLocale = 'zh-CN'
    vi.useRealTimers()
    stubPoll(null, { throws: true })
  })

  afterEach(() => {
    cleanup()
    resetNoticeStoreForTests()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders a notice already received from notice.json', () => {
    ingestNoticePayload({ notice: makeNotice() })
    render(<EmergencyNoticeBanner />)
    expect(screen.getByText('服务维护')).toBeTruthy()
    expect(screen.getByText('预计一小时')).toBeTruthy()
  })

  it('fetches notice.json when the page component mounts', async () => {
    const fetchMock = stubPoll({ notice: makeNotice({ id: 7 }), serverTime: 'now' })
    render(<EmergencyNoticeBanner />)
    expect(banner()).toBeNull()

    await flushFetch()
    expect(screen.getByText('服务维护')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(firstCall[0]).toBe(NOTICE_POLL_ENDPOINT)
  })

  it('renders nothing when notice.json reports no notice', async () => {
    ingestNoticePayload({ notice: makeNotice() })
    stubPoll({ notice: null, serverTime: 'now' })
    render(<EmergencyNoticeBanner />)
    expect(screen.getByText('服务维护')).toBeTruthy()

    await flushFetch()
    expect(banner()).toBeNull()
  })

  it('never renders a close button', () => {
    ingestNoticePayload({ notice: makeNotice() })
    render(<EmergencyNoticeBanner />)
    expect(banner()).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'common.close' })).toBeNull()
  })

  it('keeps showing the notice across remounts until the store retires it', () => {
    ingestNoticePayload({ notice: makeNotice() })
    const { unmount } = render(<EmergencyNoticeBanner />)
    expect(screen.getByText('服务维护')).toBeTruthy()

    unmount()
    render(<EmergencyNoticeBanner />)
    expect(screen.getByText('服务维护')).toBeTruthy()
  })

  it('falls back current locale → zh-CN → en, and skips the banner when all are missing', () => {
    mockLocale = 'ja'
    ingestNoticePayload({ notice: makeNotice({ title: { 'zh-CN': '中文标题', en: 'EN title' }, body: {} }) })
    render(<EmergencyNoticeBanner />)
    expect(screen.getByText('中文标题')).toBeTruthy()

    cleanup()
    resetNoticeStoreForTests()
    ingestNoticePayload({ notice: makeNotice({ title: { en: 'EN only' }, body: {} }) })
    render(<EmergencyNoticeBanner />)
    expect(screen.getByText('EN only')).toBeTruthy()

    cleanup()
    resetNoticeStoreForTests()
    const { container } = render(
      <EmergencyNoticeBanner />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('gives each level its own colour, icon and aria semantics', () => {
    const seen = new Set<string>()
    for (const level of ['info', 'warning', 'critical'] as const) {
      cleanup()
      resetNoticeStoreForTests()
      ingestNoticePayload({ notice: makeNotice({ level }) })
      render(<EmergencyNoticeBanner />)
      const element = banner()
      expect(element?.getAttribute('data-level')).toBe(level)
      expect(element?.getAttribute('role')).toBe(level === 'critical' ? 'alert' : 'status')
      const background = [...(element?.classList ?? [])].find((className) => className.startsWith('bg-'))
      expect(background).toBeTruthy()
      seen.add(background!)
      expect(element?.querySelector('.animate-ping') !== null).toBe(level === 'critical')
    }
    expect(seen.size).toBe(3)
  })

  it('renders an external link with rel="noopener noreferrer"', () => {
    ingestNoticePayload({
      notice: makeNotice({ linkUrl: 'https://end.canmoe.com/status', linkLabel: { 'zh-CN': '状态页' } }),
    })
    render(<EmergencyNoticeBanner />)
    const link = screen.getByRole('button', { name: '状态页' })
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('https://end.canmoe.com/status')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('falls back to common.viewDetails when linkLabel is missing', () => {
    ingestNoticePayload({ notice: makeNotice({ linkUrl: '/zh-CN/about', linkLabel: null }) })
    render(<EmergencyNoticeBanner />)
    const link = screen.getByRole('button', { name: 'common.viewDetails' })
    expect(link.getAttribute('href')).toBe('/zh-CN/about')
    expect(link.getAttribute('target')).toBeNull()
    expect(link.getAttribute('rel')).toBeNull()
  })

  it('survives malformed payloads without throwing', () => {
    const cases: unknown[] = [
      undefined,
      null,
      'boom',
      42,
      [],
      {},
      { notice: 'boom' },
      { notice: { id: 'nope', title: { en: 'x' } } },
      { notice: { id: 1 } },
      { notice: { id: 1, title: { en: 'x' }, linkUrl: 'javascript:alert(1)', linkLabel: 7, body: 3 } },
    ]
    for (const payload of cases) {
      cleanup()
      resetNoticeStoreForTests()
      expect(() => ingestNoticePayload(payload)).not.toThrow()
      expect(() => render(<EmergencyNoticeBanner />)).not.toThrow()
    }

    expect(screen.getByText('x')).toBeTruthy()
    expect(document.querySelector('a')).toBeNull()
  })

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('swaps to a newer notice delivered by polling', async () => {
      ingestNoticePayload({ notice: makeNotice() })
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ notice: makeNotice() }) })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ notice: makeNotice({ id: 43, title: { 'zh-CN': '数据异常' } }) }),
        })
      vi.stubGlobal('fetch', fetchMock)
      render(<EmergencyNoticeBanner />)
      await flushFetch()
      expect(screen.getByText('服务维护')).toBeTruthy()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      })
      expect(screen.getByText('数据异常')).toBeTruthy()
    })

    it('keeps the banner untouched when polling fails', async () => {
      ingestNoticePayload({ notice: makeNotice() })
      render(<EmergencyNoticeBanner />)
      await flushFetch()

      for (const init of [{ throws: true }, { ok: false }] as const) {
        stubPoll({ notice: null }, init)
        await act(async () => {
          await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
        })
        expect(screen.getByText('服务维护')).toBeTruthy()
      }
    })

    it('applies the forward-compatible locales targeting', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ notice: makeNotice({ id: 51, locales: ['ja'] }) }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ notice: makeNotice({ id: 52, locales: ['zh-CN', 'ja'] }) }) })
        .mockResolvedValue({ ok: true, json: async () => ({ notice: makeNotice({ id: 53, locales: [] }) }) })
      vi.stubGlobal('fetch', fetchMock)
      render(<EmergencyNoticeBanner />)

      await flushFetch()
      expect(banner()).toBeNull()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      })
      expect(screen.getByText('服务维护')).toBeTruthy()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      })
      expect(screen.getByText('服务维护')).toBeTruthy()
    })
  })
})
