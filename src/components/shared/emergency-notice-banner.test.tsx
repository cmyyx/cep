// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import {
  NOTICE_POLL_ENDPOINT,
  NOTICE_POLL_INTERVAL_MS,
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

function dispatchBootstrap(payload: unknown) {
  act(() => {
    window.dispatchEvent(new CustomEvent('cep:bootstrap', { detail: payload }))
  })
}

function banner() {
  return document.querySelector('[data-level]')
}

/** 轮询响应桩; ok:false / throws 用来模拟失败。 */
function stubPoll(payload: unknown, init: { ok?: boolean; throws?: boolean } = {}) {
  const fetchMock = vi.fn(async () => {
    if (init.throws) throw new Error('offline')
    return { ok: init.ok ?? true, json: async () => payload }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** 推进到下一个轮询节拍并冲干净 fetch 的 microtask。 */
async function tickPoll() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
  })
}

describe('EmergencyNoticeBanner', () => {
  beforeEach(() => {
    cleanup()
    resetNoticeStoreForTests()
    mockLocale = 'zh-CN'
    window.localStorage.clear()
    delete window.__cepBootstrap
    // 默认让轮询失败: 只有显式 stubPoll 的用例才关心网络
    stubPoll(null, { throws: true })
  })

  afterEach(() => {
    cleanup()
    resetNoticeStoreForTests()
    delete window.__cepBootstrap
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders the notice already present on window (script executed before React)', () => {
    window.__cepBootstrap = { notice: makeNotice(), serverTime: '2026-07-26T00:00:00Z' }
    render(<EmergencyNoticeBanner />)
    expect(screen.getByText('服务维护')).toBeTruthy()
    expect(screen.getByText('预计一小时')).toBeTruthy()
  })

  it('picks up a payload delivered by a late cep:bootstrap event', () => {
    render(<EmergencyNoticeBanner />)
    expect(banner()).toBeNull()
    dispatchBootstrap({ notice: makeNotice(), serverTime: '2026-07-26T00:00:00Z' })
    expect(screen.getByText('服务维护')).toBeTruthy()
  })

  it('renders nothing when there is no notice', () => {
    window.__cepBootstrap = { notice: null, serverTime: '2026-07-26T00:00:00Z' }
    const { container } = render(<EmergencyNoticeBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('never renders a close button — the banner is not dismissible', () => {
    window.__cepBootstrap = { notice: makeNotice(), serverTime: '2026-07-26T00:00:00Z' }
    render(<EmergencyNoticeBanner />)
    expect(banner()).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'common.close' })).toBeNull()
    // 后端即便下发 dismissible 也不产生关闭按钮
    dispatchBootstrap({ notice: makeNotice({ id: 43, dismissible: true }), serverTime: '2026-07-26T00:00:00Z' })
    expect(screen.queryByRole('button', { name: 'common.close' })).toBeNull()
  })

  it('keeps showing the notice across remounts until ops retire it', () => {
    window.__cepBootstrap = { notice: makeNotice(), serverTime: '2026-07-26T00:00:00Z' }
    render(<EmergencyNoticeBanner />)
    expect(screen.getByText('服务维护')).toBeTruthy()

    cleanup()
    render(<EmergencyNoticeBanner />)
    expect(screen.getByText('服务维护')).toBeTruthy()
  })

  it('falls back current locale → zh-CN → en, and skips the banner when all are missing', () => {
    mockLocale = 'ja'
    window.__cepBootstrap = { notice: makeNotice({ title: { 'zh-CN': '中文标题', en: 'EN title' }, body: {} }) }
    render(<EmergencyNoticeBanner />)
    expect(screen.getByText('中文标题')).toBeTruthy()

    cleanup()
    window.__cepBootstrap = { notice: makeNotice({ title: { en: 'EN only' }, body: {} }) }
    render(<EmergencyNoticeBanner />)
    expect(screen.getByText('EN only')).toBeTruthy()

    cleanup()
    window.__cepBootstrap = { notice: makeNotice({ title: { 'zh-TW': '僅繁中' }, body: {} }) }
    const { container } = render(<EmergencyNoticeBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('gives each level its own colour, icon and aria semantics', () => {
    const seen = new Set<string>()
    for (const level of ['info', 'warning', 'critical'] as const) {
      cleanup()
      window.localStorage.clear()
      window.__cepBootstrap = { notice: makeNotice({ level }) }
      render(<EmergencyNoticeBanner />)
      const element = banner()
      expect(element?.getAttribute('data-level')).toBe(level)
      expect(element?.getAttribute('role')).toBe(level === 'critical' ? 'alert' : 'status')
      const background = [...(element?.classList ?? [])].find((c) => c.startsWith('bg-'))
      expect(background).toBeTruthy()
      seen.add(background!)
      // critical 额外带一个脉冲圆点作为第三档强化
      expect(element?.querySelector('.animate-ping') !== null).toBe(level === 'critical')
    }
    expect(seen.size).toBe(3)
  })

  it('renders an external link with rel="noopener noreferrer"', () => {
    window.__cepBootstrap = {
      notice: makeNotice({ linkUrl: 'https://end.canmoe.com/status', linkLabel: { 'zh-CN': '状态页' } }),
    }
    render(<EmergencyNoticeBanner />)
    // Base UI Button 用 render 渲染成 <a> 时保留 role="button", 与仓库既有测试一致
    const link = screen.getByRole('button', { name: '状态页' })
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('https://end.canmoe.com/status')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('falls back to common.viewDetails when linkLabel is missing', () => {
    window.__cepBootstrap = { notice: makeNotice({ linkUrl: '/zh-CN/about', linkLabel: null }) }
    render(<EmergencyNoticeBanner />)
    const link = screen.getByRole('button', { name: 'common.viewDetails' })
    expect(link.getAttribute('href')).toBe('/zh-CN/about')
    expect(link.getAttribute('target')).toBeNull()
    expect(link.getAttribute('rel')).toBeNull()
  })

  it('survives missing and malformed payloads without rendering or throwing', () => {
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
      window.localStorage.clear()
      window.__cepBootstrap = payload
      expect(() => render(<EmergencyNoticeBanner />)).not.toThrow()
    }
    // 最后一例是"合法 id + 合法标题 + 全部畸形可选字段": 应降级展示纯文本, 不带链接
    expect(screen.getByText('x')).toBeTruthy()
    expect(document.querySelector('a')).toBeNull()
  })

  describe('polling /api/v1/notice.json', () => {
    // 定时器必须在 render 之前伪造: interval 是挂载时建立的
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('shows a notice that arrives only through polling', async () => {
      const fetchMock = stubPoll({ notice: makeNotice({ id: 7 }), serverTime: 'now' })
      render(<EmergencyNoticeBanner />)
      expect(banner()).toBeNull()
      // 挂载本身不请求: 整页加载已经由 <head> 的 bootstrap.js 取过一次
      expect(fetchMock).not.toHaveBeenCalled()

      await tickPoll()
      expect(screen.getByText('服务维护')).toBeTruthy()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect((fetchMock.mock.calls[0] as unknown as string[])[0]).toContain(NOTICE_POLL_ENDPOINT)
    })

    it('retires a visible banner when polling reports the notice is gone', async () => {
      window.__cepBootstrap = { notice: makeNotice() }
      stubPoll({ notice: null, serverTime: 'now' })
      render(<EmergencyNoticeBanner />)
      expect(screen.getByText('服务维护')).toBeTruthy()

      await tickPoll()
      expect(banner()).toBeNull()
    })

    it('keeps the banner untouched when polling fails', async () => {
      window.__cepBootstrap = { notice: makeNotice() }
      render(<EmergencyNoticeBanner />)

      for (const init of [{ throws: true }, { ok: false }] as const) {
        stubPoll({ notice: null }, init)
        await tickPoll()
        expect(screen.getByText('服务维护')).toBeTruthy()
      }

      // 200 但响应体不是 JSON
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => {
            throw new SyntaxError('Unexpected token <')
          },
        }))
      )
      await tickPoll()
      expect(screen.getByText('服务维护')).toBeTruthy()
    })

    it('swaps to a newer notice delivered by polling', async () => {
      window.__cepBootstrap = { notice: makeNotice() }
      render(<EmergencyNoticeBanner />)
      expect(screen.getByText('服务维护')).toBeTruthy()

      stubPoll({ notice: makeNotice({ id: 43, title: { 'zh-CN': '数据异常' } }) })
      await tickPoll()
      expect(screen.getByText('数据异常')).toBeTruthy()
    })

    it('applies the forward-compatible locales targeting', async () => {
      stubPoll({ notice: makeNotice({ id: 51, locales: ['ja'] }) })
      render(<EmergencyNoticeBanner />)
      await tickPoll()
      expect(banner()).toBeNull()

      stubPoll({ notice: makeNotice({ id: 52, locales: ['zh-CN', 'ja'] }) })
      await tickPoll()
      expect(screen.getByText('服务维护')).toBeTruthy()

      // 空数组 = 不限语言
      stubPoll({ notice: makeNotice({ id: 53, locales: [] }) })
      await tickPoll()
      expect(screen.getByText('服务维护')).toBeTruthy()
    })

    it('refreshes immediately when the tab becomes visible again', async () => {
      const fetchMock = stubPoll({ notice: makeNotice({ id: 61 }) })
      render(<EmergencyNoticeBanner />)

      fireEvent(document, new Event('visibilitychange'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(screen.getByText('服务维护')).toBeTruthy()
    })

    it('stops polling and detaches every listener on unmount', async () => {
      const fetchMock = stubPoll({ notice: makeNotice({ id: 71 }) })
      const { unmount } = render(<EmergencyNoticeBanner />)
      unmount()

      await tickPoll()
      fireEvent(document, new Event('visibilitychange'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(fetchMock).not.toHaveBeenCalled()

      // bootstrap 事件监听也一起摘掉了: 卸载后到达的载荷不再写进 store
      dispatchBootstrap({ notice: makeNotice({ id: 72 }) })
      expect(banner()).toBeNull()
    })
  })
})
