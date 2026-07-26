// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

// The planner stores kick off loadPlannerData() at module scope; stub it so the
// multi-MB generated dataset never enters the test run.
vi.mock('@/lib/planner/planner-data-loader', () => ({
  getCachedPlannerGameData: () => undefined,
  loadPlannerData: () => Promise.resolve({}),
}))

const { importModule } = await import('./data-importer')
const { useAnnouncementStore } = await import('@/stores/useAnnouncementStore')

function persisted(key: string): { state?: Record<string, unknown> } | null {
  const raw = localStorage.getItem(key)
  return raw ? (JSON.parse(raw) as { state?: Record<string, unknown> }) : null
}

beforeEach(() => {
  localStorage.clear()
})

describe('importModule: announcement-read', () => {
  it('writes through the store so the in-memory readIds are not stale', async () => {
    useAnnouncementStore.setState({ readIds: ['stale-1', 'stale-2'], announcements: [] })

    await importModule('announcement-read', { readIds: ['ann-a', 'ann-b'] })

    expect(useAnnouncementStore.getState().readIds).toEqual(['ann-a', 'ann-b'])
    expect(persisted('cep-announcement-read-ids')?.state?.readIds).toEqual(['ann-a', 'ann-b'])
  })

  it('survives the next store write (the localStorage-only bug)', async () => {
    useAnnouncementStore.setState({ readIds: ['stale-1'], announcements: [] })

    await importModule('announcement-read', { readIds: ['ann-a'] })
    // Any later set() re-persists from memory — the stale marker must be gone.
    useAnnouncementStore.getState().markAsRead('ann-b')

    expect(useAnnouncementStore.getState().readIds).toEqual(['ann-a', 'ann-b'])
    expect(persisted('cep-announcement-read-ids')?.state?.readIds).toEqual(['ann-a', 'ann-b'])
  })

  it('accepts legacy payload shapes and rejects junk', async () => {
    await importModule('announcement-read', ['legacy-a', 42])
    expect(useAnnouncementStore.getState().readIds).toEqual(['legacy-a'])

    await importModule('announcement-read', { ids: ['legacy-b'] })
    expect(useAnnouncementStore.getState().readIds).toEqual(['legacy-b'])
  })
})

describe('importModule: growth-planner', () => {
  it('restores configs into the store and localStorage', async () => {
    const { useGrowthPlannerStore } = await import('@/stores/useGrowthPlannerStore')
    const configs = [
      { kind: 'character', id: 'chr_0001' },
      { kind: 'weapon', id: 'wpn_sword_0001' },
    ]

    await importModule('growth-planner', { configs, removedConfigs: [{ kind: 'weapon', id: 'wpn_sword_0002' }] })

    const state = useGrowthPlannerStore.getState()
    expect(state.configs.map((c) => c.id)).toEqual(['chr_0001', 'wpn_sword_0001'])
    expect(state.removedConfigs.map((c) => c.id)).toEqual(['wpn_sword_0002'])
    // persist owns the envelope (name + schema version), so the key must exist.
    expect(persisted('growthPlanner')?.state?.configs).toHaveLength(2)
  })

  it('clears previous state for an empty payload', async () => {
    const { useGrowthPlannerStore } = await import('@/stores/useGrowthPlannerStore')
    await importModule('growth-planner', { configs: [{ kind: 'character', id: 'chr_0001' }] })

    await importModule('growth-planner', { configs: 'not-an-array' })

    expect(useGrowthPlannerStore.getState().configs).toEqual([])
  })
})

describe('importModule: panel-preview', () => {
  it('restores the config into the store and localStorage', async () => {
    const { usePanelPreviewStore } = await import('@/stores/usePanelPreviewStore')

    await importModule('panel-preview', { config: { characterId: 'chr_0001', level: 80 } })

    expect(usePanelPreviewStore.getState().config?.characterId).toBe('chr_0001')
    expect(persisted('panelPreview')?.state?.config).toMatchObject({ characterId: 'chr_0001' })
  })

  it('resets to null when the payload has no config', async () => {
    const { usePanelPreviewStore } = await import('@/stores/usePanelPreviewStore')
    await importModule('panel-preview', { config: { characterId: 'chr_0001' } })

    await importModule('panel-preview', { config: null })

    expect(usePanelPreviewStore.getState().config).toBeNull()
  })
})

describe('importModule: unknown module', () => {
  it('is a no-op', async () => {
    await importModule('not-a-module', { anything: true })
    await importModule('growth-planner', null)
    expect(localStorage.getItem('not-a-module')).toBeNull()
  })
})
