// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  pruneReadIds,
  resetAnnouncementLoadStateForTests,
  useAnnouncementStore,
} from './useAnnouncementStore'
import { announcementHashManifest } from '@/generated/announcement-hash-manifest'

function jsonResponse(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    headers: { get: () => null },
    json: async () => data,
    text: async () => JSON.stringify(data),
    body: null,
  } as unknown as Response
}

function textResponse(text: string, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    headers: { get: () => null },
    json: async () => ({}),
    text: async () => text,
    body: null,
  } as unknown as Response
}

describe('pruneReadIds', () => {
  it('keeps only IDs still present in the catalog index', () => {
    expect(pruneReadIds(['a', 'b', 'gone'], new Set(['a', 'b', 'c']))).toEqual(['a', 'b'])
  })

  it('keeps all IDs when the full index is present even if content failed elsewhere', () => {
    // Simulates: index has a/b/c, but only a loaded — read markers for b/c must survive
    expect(pruneReadIds(['a', 'b', 'c'], new Set(['a', 'b', 'c']))).toEqual(['a', 'b', 'c'])
  })

  it('returns empty only when none of the read IDs remain in the index', () => {
    expect(pruneReadIds(['x', 'y'], new Set(['a', 'b']))).toEqual([])
  })
})

describe('readIds persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    useAnnouncementStore.setState({ announcements: [], readIds: [] })
  })

  it('persists readIds written via setState', () => {
    // Data import relies on this: writing localStorage directly instead would be
    // overwritten by the store's own (stale) copy on the next set().
    useAnnouncementStore.setState({ readIds: ['ann-a', 'ann-b'] })

    const stored = JSON.parse(localStorage.getItem('cep-announcement-read-ids') ?? 'null') as {
      state?: { readIds?: string[] }
    } | null
    expect(stored?.state?.readIds).toEqual(['ann-a', 'ann-b'])
  })

  it('keeps only readIds in storage (partialize)', () => {
    useAnnouncementStore.setState({
      readIds: ['ann-a'],
      announcements: [
        { id: 'ann-a', title: 'A', content: 'body', publishTime: '2026-01-01T00:00:00.000Z', priority: 'normal' },
      ],
    })

    const stored = JSON.parse(localStorage.getItem('cep-announcement-read-ids') ?? 'null') as {
      state?: Record<string, unknown>
    } | null
    expect(Object.keys(stored?.state ?? {})).toEqual(['readIds'])
  })
})

describe('useAnnouncementStore loadAnnouncements', () => {
  beforeEach(() => {
    localStorage.clear()
    resetAnnouncementLoadStateForTests()
    useAnnouncementStore.setState({
      announcements: [],
      readIds: [],
      isLoading: true,
      loadError: false,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does not wipe readIds when some markdown files fail to load', async () => {
    useAnnouncementStore.setState({
      readIds: ['ann-a', 'ann-b', 'ann-c'],
    })

    const index = [
      {
        id: 'ann-a',
        title: 'A',
        file: 'a.md',
        publishTime: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'ann-b',
        title: 'B',
        file: 'b.md',
        publishTime: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'ann-c',
        title: 'C',
        file: 'c.md',
        publishTime: '2026-01-03T00:00:00.000Z',
      },
    ]

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('index.generated.json')) {
          return jsonResponse(index)
        }
        if (url.includes('a.md')) {
          return textResponse('# A body')
        }
        // Slow / failed network for the rest
        return textResponse('', false)
      })
    )

    await useAnnouncementStore.getState().loadAnnouncements()

    const state = useAnnouncementStore.getState()
    // A missing announcement is a load error (so the next call retries it) even
    // though the entry that did load is kept below.
    expect(state.loadError).toBe(true)
    // Only A loaded successfully
    expect(state.announcements.map((a) => a.id)).toEqual(['ann-a'])
    // But all three read markers must remain (still in catalog index)
    expect(state.readIds).toEqual(['ann-a', 'ann-b', 'ann-c'])

    // And localStorage must not have been wiped
    const stored = JSON.parse(localStorage.getItem('cep-announcement-read-ids') ?? 'null') as {
      state?: { readIds?: string[] }
    } | null
    expect(stored?.state?.readIds).toEqual(['ann-a', 'ann-b', 'ann-c'])
  })

  it('prunes only IDs that disappeared from the catalog index', async () => {
    useAnnouncementStore.setState({
      readIds: ['ann-a', 'ann-deleted'],
    })

    const index = [
      {
        id: 'ann-a',
        title: 'A',
        content: 'inline body',
        publishTime: '2026-01-01T00:00:00.000Z',
      },
    ]

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('index.generated.json')) {
          return jsonResponse(index)
        }
        return textResponse('', false)
      })
    )

    await useAnnouncementStore.getState().loadAnnouncements()

    const state = useAnnouncementStore.getState()
    expect(state.announcements).toHaveLength(1)
    expect(state.readIds).toEqual(['ann-a'])
  })

  it('does not clear readIds when the whole load fails', async () => {
    useAnnouncementStore.setState({
      readIds: ['ann-a', 'ann-b'],
      announcements: [],
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      })
    )

    await useAnnouncementStore.getState().loadAnnouncements()

    const state = useAnnouncementStore.getState()
    expect(state.loadError).toBe(true)
    expect(state.announcements).toEqual([])
    expect(state.readIds).toEqual(['ann-a', 'ann-b'])
  })

  it('version-stamps markdown URLs from the build manifest instead of busting the cache', async () => {
    // Production serves /announcements/*.md with `immutable`, so the old
    // `?t=Date.now()` made every navigation a cache miss. The build emits a
    // content hash per file; the URL must carry it and must NOT carry `t=`.
    const [manifestPath, hash] = Object.entries(announcementHashManifest)[0]
    const file = manifestPath.replace('/announcements/', '')

    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        urls.push(url)
        if (url.includes('index.generated.json')) {
          return jsonResponse([
            { id: 'ann-1', title: 'A', file, publishTime: '2026-01-01T00:00:00.000Z' },
          ])
        }
        return textResponse('# body')
      })
    )

    await useAnnouncementStore.getState().loadAnnouncements()

    expect(urls).toContain(`${manifestPath}?v=${hash}`)
    for (const url of urls) expect(url).not.toContain('t=')
  })

  it('leaves the index URL unversioned so new announcements can still be discovered', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input))
        if (String(input).includes('index.generated.json')) {
          return jsonResponse([
            { id: 'ann-1', title: 'A', content: 'inline', publishTime: '2026-01-01T00:00:00.000Z' },
          ])
        }
        return textResponse('', false)
      })
    )

    await useAnnouncementStore.getState().loadAnnouncements()

    expect(urls).toContain('/announcements/index.generated.json')
  })

  it('does not refetch on a second call in the same session', async () => {
    // AnnouncementLoader re-runs on every route change.
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('index.generated.json')) {
        return jsonResponse([
          { id: 'ann-1', title: 'A', content: 'inline', publishTime: '2026-01-01T00:00:00.000Z' },
        ])
      }
      return textResponse('', false)
    })
    vi.stubGlobal('fetch', fetchMock)

    await useAnnouncementStore.getState().loadAnnouncements()
    const callsAfterFirstLoad = fetchMock.mock.calls.length
    expect(callsAfterFirstLoad).toBeGreaterThan(0)

    await useAnnouncementStore.getState().loadAnnouncements()
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirstLoad)
  })

  it('retries after a failed load rather than caching the failure', async () => {
    let failing = true
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (failing) throw new Error('network down')
        if (String(input).includes('index.generated.json')) {
          return jsonResponse([
            { id: 'ann-1', title: 'A', content: 'inline', publishTime: '2026-01-01T00:00:00.000Z' },
          ])
        }
        return textResponse('', false)
      })
    )

    await useAnnouncementStore.getState().loadAnnouncements()
    expect(useAnnouncementStore.getState().loadError).toBe(true)

    failing = false
    await useAnnouncementStore.getState().loadAnnouncements()
    expect(useAnnouncementStore.getState().loadError).toBe(false)
    expect(useAnnouncementStore.getState().announcements.map((a) => a.id)).toEqual(['ann-1'])
  })

  it('keeps the announcements that loaded and retries the one that failed', async () => {
    // Index lists two entries; one markdown 404s and has no inline copy. The load
    // must not be remembered as complete (the missing announcement would then never
    // appear), and the entry that did load must survive the failure so its banner
    // and unread count stay correct.
    const [okPath, brokenPath] = Object.keys(announcementHashManifest)
    const okFile = okPath.replace('/announcements/', '')
    const brokenFile = brokenPath.replace('/announcements/', '')
    let brokenFailing = true
    const urls: string[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        urls.push(url)
        if (url.includes('index.generated.json')) {
          return jsonResponse([
            { id: 'ok', title: 'ok', file: okFile, publishTime: '2026-01-01T00:00:00.000Z' },
            { id: 'broken', title: 'broken', file: brokenFile, publishTime: '2025-01-01T00:00:00.000Z' },
          ])
        }
        if (url.includes(brokenFile) && brokenFailing) return textResponse('', false)
        return textResponse('# body')
      })
    )

    await useAnnouncementStore.getState().loadAnnouncements()
    const afterFirst = useAnnouncementStore.getState()
    expect(afterFirst.loadError).toBe(true)
    expect(afterFirst.announcements.map((a) => a.id)).toEqual(['ok'])

    // Second call: the failed markdown loads this time, and the load is remembered.
    brokenFailing = false
    await useAnnouncementStore.getState().loadAnnouncements()
    const afterRetry = useAnnouncementStore.getState()
    expect(afterRetry.loadError).toBe(false)
    expect([...afterRetry.announcements.map((a) => a.id)].sort()).toEqual(['broken', 'ok'])

    const indexRequests = () => urls.filter((u) => u.includes('index.generated.json')).length
    const before = indexRequests()
    await useAnnouncementStore.getState().loadAnnouncements()
    expect(indexRequests()).toBe(before)
  })
})
