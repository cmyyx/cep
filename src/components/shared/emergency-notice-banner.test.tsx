// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import {
  NOTICE_POLL_ENDPOINT,
  NOTICE_POLL_INTERVAL_MS,
  ingestNoticePayload,
  resetNoticeStoreForTests,
} from '@/lib/notice-store'
import {
  NOTICE_DISMISS_STORAGE_KEY,
  resetNoticeDismissForTests,
} from '@/lib/notice-dismiss'
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
    dismissible: true,
    updatedAt: '2026-07-26T00:00:00Z',
    ...overrides,
  }
}

function banner() {
  return document.querySelector('[data-level]')
}

/**
 * jsdom 不做布局, scrollHeight / clientHeight 恒为 0, 溢出测量永远判定"没超出"。
 * 这两个属性在 Element.prototype 上, 所以在 HTMLElement.prototype 上覆盖一层,
 * 用完 delete 掉即可恢复继承来的 getter。
 */
function stubBodyOverflow(overflows: boolean) {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => (overflows ? 60 : 20),
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 20,
  })
}

function clearBodyOverflowStub() {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>
  delete proto.scrollHeight
  delete proto.clientHeight
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
    resetNoticeDismissForTests()
    window.localStorage.clear()
    mockLocale = 'zh-CN'
    vi.useRealTimers()
    stubPoll(null, { throws: true })
  })

  afterEach(() => {
    cleanup()
    resetNoticeStoreForTests()
    resetNoticeDismissForTests()
    window.localStorage.clear()
    clearBodyOverflowStub()
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

  it('renders a close button when the operator allows dismissing', () => {
    ingestNoticePayload({ notice: makeNotice({ dismissible: true }) })
    render(<EmergencyNoticeBanner />)
    expect(banner()).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'common.close' })).not.toBeNull()
  })

  it('hides the close button when the operator turned the switch off', () => {
    ingestNoticePayload({ notice: makeNotice({ dismissible: false }) })
    render(<EmergencyNoticeBanner />)
    expect(banner()).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'common.close' })).toBeNull()
  })

  it('hides the close button for a legacy payload without the field', () => {
    // 旧版服务端不下发 dismissible。缺字段退化为"强制显示": 宁可多打扰一次, 也不要把
    // 一条运营以为在展示的公告悄悄变成"关过的人再也看不到"。
    ingestNoticePayload({ notice: makeNotice({ dismissible: undefined }) })
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

  describe('dismissal', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    async function clickClose() {
      fireEvent.click(screen.getByRole('button', { name: 'common.close' }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200)
      })
    }

    it('removes the banner and remembers the dismissal', async () => {
      ingestNoticePayload({ notice: makeNotice() })
      render(<EmergencyNoticeBanner />)
      await clickClose()

      expect(banner()).toBeNull()
      expect(window.localStorage.getItem(NOTICE_DISMISS_STORAGE_KEY)).toBe('42@2026-07-26T00:00:00Z')
    })

    it('stays closed across a remount', async () => {
      ingestNoticePayload({ notice: makeNotice() })
      const { unmount } = render(<EmergencyNoticeBanner />)
      await clickClose()
      unmount()

      render(<EmergencyNoticeBanner />)
      expect(banner()).toBeNull()
    })

    it('comes back when the operator edits the copy', async () => {
      ingestNoticePayload({ notice: makeNotice() })
      render(<EmergencyNoticeBanner />)
      await clickClose()
      expect(banner()).toBeNull()

      // 同一个 id, updatedAt 变了 → 运营改了内容 → 必须重新弹出, 否则改文案等于静音
      await act(async () => {
        ingestNoticePayload({ notice: makeNotice({ updatedAt: '2026-08-01T00:00:00Z' }) })
      })
      expect(screen.getByText('服务维护')).toBeTruthy()
    })

    it('does not dismiss a notice that replaced the one being closed', async () => {
      ingestNoticePayload({ notice: makeNotice() })
      render(<EmergencyNoticeBanner />)
      fireEvent.click(screen.getByRole('button', { name: 'common.close' }))

      // 退场动画还在跑的时候轮询换上了另一条公告: 那条不能被上一条的关闭记录带走
      await act(async () => {
        ingestNoticePayload({ notice: makeNotice({ id: 43, title: { 'zh-CN': '数据异常' } }) })
      })
      expect(screen.getByText('数据异常')).toBeTruthy()
      // 关闭记录只针对被点掉的那一条, 新公告要正常显示
      expect(window.localStorage.getItem(NOTICE_DISMISS_STORAGE_KEY)).toBe('42@2026-07-26T00:00:00Z')
    })
  })

  describe('long body', () => {
    it('clamps the body to two lines by default', () => {
      ingestNoticePayload({ notice: makeNotice() })
      render(<EmergencyNoticeBanner />)
      const body = screen.getByText('预计一小时')
      expect(body.classList.contains('line-clamp-2')).toBe(true)
      expect(body.classList.contains('overflow-y-auto')).toBe(false)
    })

    it('offers no expand toggle when the body fits', () => {
      stubBodyOverflow(false)
      ingestNoticePayload({ notice: makeNotice() })
      render(<EmergencyNoticeBanner />)
      expect(screen.queryByRole('button', { name: 'notice.expand' })).toBeNull()
    })

    it('expands into a height capped scroll area, never the whole screen', async () => {
      stubBodyOverflow(true)
      ingestNoticePayload({ notice: makeNotice() })
      render(<EmergencyNoticeBanner />)

      fireEvent.click(screen.getByRole('button', { name: 'notice.expand' }))
      await act(async () => {
        await Promise.resolve()
      })

      const body = screen.getByText('预计一小时')
      expect(body.classList.contains('line-clamp-2')).toBe(false)
      expect(body.classList.contains('overflow-y-auto')).toBe(true)
      expect(body.className).toContain('max-h-[40svh]')
      expect(screen.getByRole('button', { name: 'notice.collapse' })).toBeTruthy()
    })

    it('collapses back to two lines', async () => {
      stubBodyOverflow(true)
      ingestNoticePayload({ notice: makeNotice() })
      render(<EmergencyNoticeBanner />)

      fireEvent.click(screen.getByRole('button', { name: 'notice.expand' }))
      await act(async () => {
        await Promise.resolve()
      })
      fireEvent.click(screen.getByRole('button', { name: 'notice.collapse' }))
      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.getByText('预计一小时').classList.contains('line-clamp-2')).toBe(true)
    })

    it('resets to collapsed when a new notice arrives', async () => {
      stubBodyOverflow(true)
      ingestNoticePayload({ notice: makeNotice() })
      render(<EmergencyNoticeBanner />)

      fireEvent.click(screen.getByRole('button', { name: 'notice.expand' }))
      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.getByRole('button', { name: 'notice.collapse' })).toBeTruthy()

      await act(async () => {
        ingestNoticePayload({
          notice: makeNotice({ id: 44, body: { 'zh-CN': '另一条公告的正文' } }),
        })
      })
      expect(screen.getByRole('button', { name: 'notice.expand' })).toBeTruthy()
    })
  })

  it('keeps the actions out of the text column so the body keeps the full width', () => {
    stubBodyOverflow(true)
    ingestNoticePayload({
      notice: makeNotice({ linkUrl: 'https://end.canmoe.com/status', linkLabel: { 'zh-CN': '状态页' } }),
    })
    render(<EmergencyNoticeBanner />)

    const body = screen.getByText('预计一小时')
    const textColumn = body.parentElement
    // 正文与标题所在的那一列里不能有按钮: 按钮在侧边会按自己的宽度挤压每一行正文
    expect(textColumn?.querySelector('button')).toBeNull()

    // 展开开关与链接按钮共用底部操作行, 两者都不在正文那一列里
    const expand = screen.getByRole('button', { name: 'notice.expand' })
    const link = screen.getByRole('button', { name: '状态页' })
    expect(textColumn?.contains(expand)).toBe(false)
    expect(textColumn?.contains(link)).toBe(false)
    expect(expand.parentElement).toBe(link.parentElement)
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
