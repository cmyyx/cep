// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BOOTSTRAP_EVENT_NAME } from './bootstrap-notice'
import {
  NOTICE_POLL_ENDPOINT,
  NOTICE_POLL_INTERVAL_MS,
  NOTICE_VISIBILITY_REFRESH_CD_MS,
  getNoticeServerSnapshot,
  getNoticeSnapshot,
  ingestNoticePayload,
  resetNoticeStoreForTests,
  startNoticePolling,
  subscribeNotice,
} from './notice-store'

function makeNotice(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    level: 'warning',
    title: { 'zh-CN': '服务维护', en: 'Maintenance' },
    body: {},
    dismissible: true,
    ...overrides,
  }
}

/** 一次轮询响应; 传 null 让请求失败。 */
function stubFetch(payload: unknown, init: { ok?: boolean; throws?: boolean } = {}) {
  const fetchMock = vi.fn(async () => {
    if (init.throws) throw new Error('offline')
    return {
      ok: init.ok ?? true,
      json: async () => payload,
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

function fireVisibilityChange() {
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('notice store', () => {
  beforeEach(() => {
    resetNoticeStoreForTests()
    delete window.__cepBootstrap
    setVisibility('visible')
  })

  afterEach(() => {
    resetNoticeStoreForTests()
    delete window.__cepBootstrap
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts empty and keeps the SSG snapshot null', () => {
    expect(getNoticeSnapshot()).toBeNull()
    expect(getNoticeServerSnapshot()).toBeNull()
  })

  it('reads a bootstrap value that landed before the first subscriber', () => {
    window.__cepBootstrap = { notice: makeNotice(), serverTime: '2026-07-26T00:00:00Z' }
    const listener = vi.fn()
    subscribeNotice(listener)
    expect(getNoticeSnapshot()?.id).toBe(42)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('picks up a late cep:bootstrap event and mirrors the detail onto window', () => {
    const listener = vi.fn()
    subscribeNotice(listener)
    expect(getNoticeSnapshot()).toBeNull()

    const payload = { notice: makeNotice({ id: 7 }) }
    window.dispatchEvent(new CustomEvent(BOOTSTRAP_EVENT_NAME, { detail: payload }))
    expect(getNoticeSnapshot()?.id).toBe(7)
    expect(window.__cepBootstrap).toBe(payload)
  })

  it('keeps the snapshot reference stable for content-identical payloads', () => {
    const listener = vi.fn()
    subscribeNotice(listener)
    ingestNoticePayload({ notice: makeNotice() })
    const first = getNoticeSnapshot()
    expect(listener).toHaveBeenCalledTimes(1)

    // 同样的内容、不同的对象: 不该换引用, 也不该惊动订阅者
    ingestNoticePayload({ notice: makeNotice() })
    expect(getNoticeSnapshot()).toBe(first)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('ignores malformed payloads instead of clearing the current notice', () => {
    subscribeNotice(vi.fn())
    ingestNoticePayload({ notice: makeNotice() })
    for (const bad of [undefined, null, 'boom', 42, []]) {
      ingestNoticePayload(bad)
      expect(getNoticeSnapshot()?.id).toBe(42)
    }
    // notice 字段畸形但载荷是对象 → 后端明确说"没有公告"
    ingestNoticePayload({ notice: 'boom' })
    expect(getNoticeSnapshot()).toBeNull()
  })

  it('does not let a remount re-apply the same stale bootstrap value', () => {
    const payload = { notice: makeNotice() }
    window.__cepBootstrap = payload
    const unsubscribe = subscribeNotice(vi.fn())
    expect(getNoticeSnapshot()?.id).toBe(42)

    // 轮询期间公告下线
    ingestNoticePayload({ notice: null })
    expect(getNoticeSnapshot()).toBeNull()

    // locale 切换导致横幅重挂载: window 上仍是页面加载时的旧值, 不能复活公告
    unsubscribe()
    subscribeNotice(vi.fn())
    expect(getNoticeSnapshot()).toBeNull()

    // 但脚本重新下发一份新值 (新引用) 时要生效
    window.__cepBootstrap = { notice: makeNotice({ id: 43 }) }
    subscribeNotice(vi.fn())
    expect(getNoticeSnapshot()?.id).toBe(43)
  })

  it('removes the bootstrap listener once the last subscriber leaves', () => {
    const unsubscribeA = subscribeNotice(vi.fn())
    const unsubscribeB = subscribeNotice(vi.fn())
    unsubscribeA()
    window.dispatchEvent(
      new CustomEvent(BOOTSTRAP_EVENT_NAME, { detail: { notice: makeNotice({ id: 1 }) } })
    )
    expect(getNoticeSnapshot()?.id).toBe(1)

    unsubscribeB()
    window.dispatchEvent(
      new CustomEvent(BOOTSTRAP_EVENT_NAME, { detail: { notice: makeNotice({ id: 2 }) } })
    )
    expect(getNoticeSnapshot()?.id).toBe(1)
  })

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('polls the pure-data endpoint with cache busting every interval', async () => {
      const fetchMock = stubFetch({ notice: makeNotice({ id: 9 }), serverTime: 'now' })
      const stop = startNoticePolling()
      expect(fetchMock).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(url.startsWith(`${NOTICE_POLL_ENDPOINT}?t=`)).toBe(true)
      expect(options.cache).toBe('no-store')
      expect(getNoticeSnapshot()?.id).toBe(9)

      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      stop()
    })

    it('lets a polled notice:null retire the notice on screen', async () => {
      window.__cepBootstrap = { notice: makeNotice() }
      subscribeNotice(vi.fn())
      expect(getNoticeSnapshot()?.id).toBe(42)

      stubFetch({ notice: null, serverTime: 'now' })
      const stop = startNoticePolling()
      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(getNoticeSnapshot()).toBeNull()
      stop()
    })

    it('keeps the current notice when the poll fails', async () => {
      window.__cepBootstrap = { notice: makeNotice() }
      subscribeNotice(vi.fn())
      const stop = startNoticePolling()

      for (const init of [{ throws: true }, { ok: false }] as const) {
        stubFetch({ notice: null }, init)
        await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
        expect(getNoticeSnapshot()?.id).toBe(42)
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
      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(getNoticeSnapshot()?.id).toBe(42)
      stop()
    })

    it('skips the interval tick while the tab is hidden', async () => {
      const fetchMock = stubFetch({ notice: null })
      const stop = startNoticePolling()
      setVisibility('hidden')
      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(fetchMock).not.toHaveBeenCalled()

      setVisibility('visible')
      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      stop()
    })

    it('refreshes once when the tab becomes visible, then respects the cooldown', async () => {
      const fetchMock = stubFetch({ notice: makeNotice({ id: 5 }) })
      const stop = startNoticePolling()

      fireVisibilityChange()
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(getNoticeSnapshot()?.id).toBe(5)

      // 快速来回切标签: 冷却窗口内不再打请求
      fireVisibilityChange()
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(NOTICE_VISIBILITY_REFRESH_CD_MS)
      fireVisibilityChange()
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      stop()
    })

    it('ignores visibilitychange while hidden', async () => {
      const fetchMock = stubFetch({ notice: null })
      const stop = startNoticePolling()
      setVisibility('hidden')
      fireVisibilityChange()
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).not.toHaveBeenCalled()
      stop()
    })

    it('clears the timer and the listener on stop, and is idempotent', async () => {
      const fetchMock = stubFetch({ notice: null })
      const stop = startNoticePolling()
      stop()
      stop()

      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS * 3)
      fireVisibilityChange()
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
    })

    it('runs a single timer for several consumers and stops with the last one', async () => {
      const fetchMock = stubFetch({ notice: null })
      const stopA = startNoticePolling()
      const stopB = startNoticePolling()
      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      stopA()
      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      stopB()
      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})
