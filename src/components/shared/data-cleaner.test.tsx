// @vitest-environment jsdom

import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { useTranslations } from 'next-intl'

// The planner stores kick off loadPlannerData() at module scope; stub it so the
// multi-MB generated dataset never enters the test run.
vi.mock('@/lib/planner/planner-data-loader', () => ({
  getCachedPlannerGameData: () => undefined,
  loadPlannerData: () => Promise.resolve({}),
}))

const { auth } = vi.hoisted(() => ({ auth: { loggedOut: 0, localCleared: 0 } }))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: () => ({
      logout: async () => { auth.loggedOut++ },
      clearLocalSession: () => { auth.localCleared++ },
    }),
  },
}))

const { buildModules, resetAllPersistedStores, resetStoreForModule } = await import('./data-cleaner')
const { getIoModules } = await import('@/lib/data-io-utils')
const { useWikiStore } = await import('@/stores/useWikiStore')
const { useAnnouncementStore } = await import('@/stores/useAnnouncementStore')

const t = ((key: string) => key) as unknown as ReturnType<typeof useTranslations>

/** Every `name: '…'` declared by a zustand persist config under src/stores. */
function persistedStoreKeys(): string[] {
  const dir = resolve(process.cwd(), 'src/stores')
  const keys = new Set<string>()
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue
    const source = readFileSync(join(dir, file), 'utf-8')
    for (const match of source.matchAll(/^\s+name: '([^']+)',$/gm)) keys.add(match[1])
  }
  return [...keys]
}

beforeEach(() => {
  localStorage.clear()
  auth.loggedOut = 0
  auth.localCleared = 0
})

describe('buildModules', () => {
  it('knows every persisted zustand key', () => {
    const known = new Set(buildModules(t).flatMap((m) => m.keys))
    // Regression: growthPlanner / panelPreview / wiki-session were listed as
    // "unrecognized data", and unrecognized deletes only drop the localStorage key
    // (the live store writes it straight back).
    for (const key of persistedStoreKeys()) {
      expect(known, `persisted key "${key}" is missing from buildModules`).toContain(key)
    }
  })

  it('can clean everything the exporter can export', () => {
    const known = new Set(buildModules(t).flatMap((m) => m.keys))
    for (const mod of getIoModules(t)) {
      expect(known, `exportable module "${mod.id}" is not cleanable`).toContain(mod.key)
    }
  })

  it('gives every module a label and a description', () => {
    for (const mod of buildModules(t)) {
      expect(mod.label, mod.id).toBeTruthy()
      expect(mod.description, mod.id).toBeTruthy()
      expect(mod.keys.length, mod.id).toBeGreaterThan(0)
    }
  })

  it('names every label/description from its own dataCleaner.modules entry', () => {
    // Regression: growth-planner / panel-preview / wiki-session borrowed SEO
    // long-form copy (meta.*Description), which read badly in the module rows and
    // forced meta.* picks into the settings route bag.
    for (const mod of buildModules(t)) {
      expect(mod.label).toBe(`dataCleaner.modules.${mod.id}.label`)
      expect(mod.description).toBe(`dataCleaner.modules.${mod.id}.desc`)
    }
  })
})

describe('resetStoreForModule', () => {
  it('resets the wiki session store', async () => {
    useWikiStore.setState({ expandedEquipmentGroups: ['suit-1'] })
    await resetStoreForModule('wiki-session')
    expect(useWikiStore.getState().expandedEquipmentGroups).toEqual([])
  })

  it('resets the announcement read markers', async () => {
    useAnnouncementStore.setState({ readIds: ['ann-a'] })
    await resetStoreForModule('announcement-read')
    expect(useAnnouncementStore.getState().readIds).toEqual([])
  })

  it('resets the growth planner store', async () => {
    const { useGrowthPlannerStore } = await import('@/stores/useGrowthPlannerStore')
    useGrowthPlannerStore.setState({
      configs: [{ kind: 'character', id: 'chr_0001' }],
      removedConfigs: [{ kind: 'weapon', id: 'wpn_sword_0001' }],
    } as never)

    await resetStoreForModule('growth-planner')

    expect(useGrowthPlannerStore.getState().configs).toEqual([])
    expect(useGrowthPlannerStore.getState().removedConfigs).toEqual([])
  })

  it('resets the panel preview store', async () => {
    const { usePanelPreviewStore } = await import('@/stores/usePanelPreviewStore')
    usePanelPreviewStore.setState({ config: { characterId: 'chr_0001' } as never })

    await resetStoreForModule('panel-preview')

    expect(usePanelPreviewStore.getState().config).toBeNull()
  })

  it('signs out for the user-data module', async () => {
    await resetStoreForModule('user-data')
    expect(auth.loggedOut).toBe(1)
    expect(auth.localCleared).toBe(0)
  })

  it('ignores unknown module ids', async () => {
    await expect(resetStoreForModule('not-a-module')).resolves.toBeUndefined()
  })
})

describe('resetAllPersistedStores', () => {
  it('signs out and empties every store so nothing survives the wipe', async () => {
    const { useGrowthPlannerStore } = await import('@/stores/useGrowthPlannerStore')
    const { usePanelPreviewStore } = await import('@/stores/usePanelPreviewStore')

    useWikiStore.setState({ expandedEquipmentGroups: ['suit-1'] })
    useAnnouncementStore.setState({ readIds: ['ann-a'] })
    useGrowthPlannerStore.setState({ configs: [{ kind: 'character', id: 'chr_0001' }] } as never)
    usePanelPreviewStore.setState({ config: { characterId: 'chr_0001' } as never })

    await resetAllPersistedStores()
    localStorage.clear()

    expect(auth.loggedOut).toBe(1)
    expect(useWikiStore.getState().expandedEquipmentGroups).toEqual([])
    expect(useAnnouncementStore.getState().readIds).toEqual([])
    expect(useGrowthPlannerStore.getState().configs).toEqual([])
    expect(usePanelPreviewStore.getState().config).toBeNull()

    // The next write from any live store must not resurrect pre-wipe data.
    useWikiStore.getState().toggleEquipmentGroup('fresh')
    useAnnouncementStore.getState().markAsRead('fresh')
    const wiki = JSON.parse(localStorage.getItem('wiki-session') ?? '{}') as { state?: { expandedEquipmentGroups?: string[] } }
    const ann = JSON.parse(localStorage.getItem('cep-announcement-read-ids') ?? '{}') as { state?: { readIds?: string[] } }
    expect(wiki.state?.expandedEquipmentGroups).toEqual(['fresh'])
    expect(ann.state?.readIds).toEqual(['fresh'])
  })
})
