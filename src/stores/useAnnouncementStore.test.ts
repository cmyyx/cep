// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pruneReadIds, useAnnouncementStore } from './useAnnouncementStore'

vi.mock('@/lib/constants', () => ({
  MIN_LOADING_DISPLAY_MS: 0,
}))

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

describe('useAnnouncementStore loadAnnouncements', () => {
  beforeEach(() => {
    localStorage.clear()
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
    expect(state.loadError).toBe(false)
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
})
