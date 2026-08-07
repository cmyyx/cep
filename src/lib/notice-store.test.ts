// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

async function flushFetch() {
  await vi.advanceTimersByTimeAsync(0)
}

describe('notice store', () => {
  beforeEach(() => {
    resetNoticeStoreForTests()
    setVisibility('visible')
  })

  afterEach(() => {
    resetNoticeStoreForTests()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts empty and keeps the SSG snapshot null', () => {
    expect(getNoticeSnapshot()).toBeNull()
    expect(getNoticeServerSnapshot()).toBeNull()
  })

  it('publishes valid notices and keeps identical snapshots stable', () => {
    const listener = vi.fn()
    subscribeNotice(listener)
    ingestNoticePayload({ notice: makeNotice() })
    const first = getNoticeSnapshot()

    expect(first?.id).toBe(42)
    expect(listener).toHaveBeenCalledTimes(1)

    ingestNoticePayload({ notice: makeNotice() })
    expect(getNoticeSnapshot()).toBe(first)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('ignores malformed payloads without clearing the current notice', () => {
    subscribeNotice(vi.fn())
    ingestNoticePayload({ notice: makeNotice() })

    for (const bad of [undefined, null, 'boom', 42, []]) {
      ingestNoticePayload(bad)
      expect(getNoticeSnapshot()?.id).toBe(42)
    }

    ingestNoticePayload({ notice: 'boom' })
    expect(getNoticeSnapshot()?.id).toBe(42)
  })

  it('allows notice:null to retire the current notice', () => {
    ingestNoticePayload({ notice: makeNotice() })
    ingestNoticePayload({ notice: null })
    expect(getNoticeSnapshot()).toBeNull()
  })

  it('removes a subscriber without affecting other subscribers', () => {
    const listenerA = vi.fn()
    const listenerB = vi.fn()
    const unsubscribeA = subscribeNotice(listenerA)
    subscribeNotice(listenerB)

    unsubscribeA()
    ingestNoticePayload({ notice: makeNotice({ id: 7 }) })

    expect(listenerA).not.toHaveBeenCalled()
    expect(listenerB).toHaveBeenCalledTimes(1)
  })

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('fetches notice.json immediately and then at each interval', async () => {
      const fetchMock = stubFetch({ notice: makeNotice({ id: 9 }), serverTime: 'now' })
      const stop = startNoticePolling()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(firstCall[0]).toBe(NOTICE_POLL_ENDPOINT)
      expect(firstCall[1]).toMatchObject({ cache: 'no-store' })
      await flushFetch()
      expect(getNoticeSnapshot()?.id).toBe(9)

      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      stop()
    })

    it('lets the initial notice.json response retire a visible notice', async () => {
      ingestNoticePayload({ notice: makeNotice() })
      stubFetch({ notice: null, serverTime: 'now' })
      const stop = startNoticePolling()

      await flushFetch()
      expect(getNoticeSnapshot()).toBeNull()
      stop()
    })

    it('keeps the current notice when the request fails', async () => {
      ingestNoticePayload({ notice: makeNotice() })
      const stop = startNoticePolling()

      await flushFetch()
      expect(getNoticeSnapshot()?.id).toBe(42)

      stubFetch({ notice: null }, { throws: true })
      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(getNoticeSnapshot()?.id).toBe(42)
      stop()
    })

    it('skips interval requests while the tab is hidden', async () => {
      const fetchMock = stubFetch({ notice: null })
      const stop = startNoticePolling()
      await flushFetch()
      expect(fetchMock).toHaveBeenCalledTimes(1)

      setVisibility('hidden')
      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      setVisibility('visible')
      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      stop()
    })

    it('refreshes after visibility cooldown and ignores rapid switches', async () => {
      const fetchMock = stubFetch({ notice: makeNotice({ id: 5 }) })
      const stop = startNoticePolling()
      await flushFetch()

      fireVisibilityChange()
      await flushFetch()
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(NOTICE_VISIBILITY_REFRESH_CD_MS)
      fireVisibilityChange()
      await flushFetch()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      stop()
    })

    it('clears the timer and visibility listener on stop', async () => {
      const fetchMock = stubFetch({ notice: null })
      const stop = startNoticePolling()
      await flushFetch()
      stop()
      stop()

      await vi.advanceTimersByTimeAsync(NOTICE_POLL_INTERVAL_MS * 3)
      fireVisibilityChange()
      await flushFetch()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
    })

    it('runs one immediate request and one timer for several consumers', async () => {
      const fetchMock = stubFetch({ notice: null })
      const stopA = startNoticePolling()
      const stopB = startNoticePolling()
      await flushFetch()
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
