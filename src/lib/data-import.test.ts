// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

// The planner stores kick off loadPlannerData() at module scope; stub it so the
// multi-MB generated dataset never enters the test run.
vi.mock('@/lib/planner/planner-data-loader', () => ({
  getCachedPlannerGameData: () => undefined,
  loadPlannerData: () => Promise.resolve({}),
}))

const { importModule, validateImportFile, readJsonFile, prepareImport, MAX_IMPORT_FILE_BYTES } = await import('./data-import')
const { projectEssenceSettingsForExport, readModule } = await import('./data-io-utils')
const { useAnnouncementStore } = await import('@/stores/useAnnouncementStore')
const { useEssenceSettingsStore } = await import('@/stores/useEssenceSettingsStore')

function persisted(key: string): { state?: Record<string, unknown> } | null {
  const raw = localStorage.getItem(key)
  return raw ? (JSON.parse(raw) as { state?: Record<string, unknown> }) : null
}

function seedTwoAccounts() {
  useEssenceSettingsStore.setState({
    accounts: [
      {
        id: 'acc_a',
        name: 'A',
        weaponOwnership: { wpn_claym_0017: true },
        essenceStatus: { wpn_claym_0017: true },
        weaponNotes: { wpn_claym_0017: 'note-a' },
        selectedWeaponIds: [],
      },
      {
        id: 'acc_b',
        name: 'B',
        weaponOwnership: { wpn_lance_0010: true },
        essenceStatus: {},
        weaponNotes: {},
        selectedWeaponIds: [],
      },
    ],
    activeAccountId: 'acc_a',
    weaponOwnership: { wpn_claym_0017: true },
    essenceStatus: { wpn_claym_0017: true },
    weaponNotes: { wpn_claym_0017: 'note-a' },
    customWeapons: [],
  })
}

beforeEach(() => {
  localStorage.clear()
})

describe('readJsonFile', () => {
  it('parses a picked file', async () => {
    const file = new File([JSON.stringify({ version: 2, modules: {} })], 'cep-data-export.json', { type: 'application/json' })

    const result = await readJsonFile(file)

    expect(result).toEqual({ ok: true, json: { version: 2, modules: {} } })
  })

  it('reports broken JSON instead of throwing', async () => {
    const file = new File(['{oops'], 'broken.json', { type: 'application/json' })

    expect(await readJsonFile(file)).toEqual({ ok: false, errorKey: 'settings.importParseError' })
  })

  it('rejects files over the size limit before reading them', async () => {
    const file = new File(['[]'], 'huge.json', { type: 'application/json' })
    Object.defineProperty(file, 'size', { value: MAX_IMPORT_FILE_BYTES + 1 })

    expect(await readJsonFile(file)).toEqual({ ok: false, errorKey: 'settings.importFileTooLarge' })
  })
})

describe('prepareImport', () => {
  it('parses a CEP envelope', async () => {
    const prepared = await prepareImport({ version: 2, exportedAt: 'x', modules: { 'matrix-session': {} } })

    expect(prepared.kind).toBe('cep-backup')
    expect(prepared.file?.version).toBe(2)
    expect(prepared.inventory).toBeNull()
  })

  it('parses a MaaEND inventory', async () => {
    const prepared = await prepareImport([
      { weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [6, 6, 3], count: 2 }] },
    ])

    expect(prepared.kind).toBe('maamend-essence')
    expect(prepared.file).toBeNull()
    expect(prepared.inventory).toMatchObject({ groupCount: 1, essenceCount: 2, weaponIds: ['wpn_sword_0012'] })
  })

  it('reports an unrecognized payload without guessing', async () => {
    expect(await prepareImport({ hello: 'world' })).toEqual({ kind: null, file: null, inventory: null })
    expect(await prepareImport([1, 2, 3])).toEqual({ kind: null, file: null, inventory: null })
  })
})

describe('validateImportFile', () => {
  it('accepts the envelope and rejects everything else', () => {
    expect(validateImportFile({ version: 2, exportedAt: 'x', modules: {} })?.version).toBe(2)
    expect(validateImportFile({ version: 1, modules: { a: 1 } })?.modules).toEqual({ a: 1 })
    expect(validateImportFile([])).toBeNull()
    expect(validateImportFile({ version: 0, modules: {} })).toBeNull()
    expect(validateImportFile({ modules: {} })).toBeNull()
  })
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

describe('importModule: essence-settings', () => {
  beforeEach(() => {
    localStorage.clear()
    seedTwoAccounts()
  })

  it('restores every account of a v2 export (no active-account duplication)', async () => {
    const exported = projectEssenceSettingsForExport(readModule('essence-settings'))!
    // The export no longer carries the active-account mirror.
    expect('weaponOwnership' in exported).toBe(false)
    expect('essenceStatus' in exported).toBe(false)
    expect('weaponNotes' in exported).toBe(false)

    // Wipe the local marks, then restore from the export.
    useEssenceSettingsStore.getState().restoreAccounts([{ id: 'acc_other', name: 'Other' }])
    await importModule('essence-settings', exported)

    const state = useEssenceSettingsStore.getState()
    expect(state.accounts.map((a) => a.id)).toEqual(['acc_a', 'acc_b'])
    expect(state.activeAccountId).toBe('acc_a')
    expect(state.weaponOwnership).toEqual({ wpn_claym_0017: true })
    expect(state.essenceStatus).toEqual({ wpn_claym_0017: true })
    expect(state.weaponNotes).toEqual({ wpn_claym_0017: 'note-a' })
    expect(state.accounts[1].weaponOwnership).toEqual({ wpn_lance_0010: true })
  })

  it('keeps the restored marks after a rehydrate (the reload-revert bug)', async () => {
    const exported = projectEssenceSettingsForExport(readModule('essence-settings'))!
    useEssenceSettingsStore.getState().restoreAccounts([{ id: 'acc_other', name: 'Other' }])

    await importModule('essence-settings', exported)
    // Hydration replays the persisted payload through mergeWithDefaults — the
    // accounts-based payload must survive that path.
    await useEssenceSettingsStore.persist.rehydrate()

    const state = useEssenceSettingsStore.getState()
    expect(state.accounts.map((a) => a.id)).toEqual(['acc_a', 'acc_b'])
    expect(state.weaponOwnership).toEqual({ wpn_claym_0017: true })
    expect(state.essenceStatus).toEqual({ wpn_claym_0017: true })
  })

  it('keeps per-account weapon selections across a rehydrate', async () => {
    useEssenceSettingsStore.setState({
      accounts: [
        { id: 'acc_a', name: 'A', weaponOwnership: {}, essenceStatus: {}, weaponNotes: {}, selectedWeaponIds: ['wpn_claym_0017'] },
        { id: 'acc_b', name: 'B', weaponOwnership: {}, essenceStatus: {}, weaponNotes: {}, selectedWeaponIds: ['wpn_lance_0010'] },
      ],
      activeAccountId: 'acc_a',
    })
    const exported = projectEssenceSettingsForExport(readModule('essence-settings'))!
    expect(
      (exported.accounts as { selectedWeaponIds: string[] }[]).map((a) => a.selectedWeaponIds),
    ).toEqual([['wpn_claym_0017'], ['wpn_lance_0010']])

    await importModule('essence-settings', exported)
    await useEssenceSettingsStore.persist.rehydrate()

    const accounts = useEssenceSettingsStore.getState().accounts
    expect(accounts.map((a) => a.selectedWeaponIds)).toEqual([
      ['wpn_claym_0017'],
      ['wpn_lance_0010'],
    ])
  })

  it('applies a v1 file (flat mirrors, no accounts) to a single account', async () => {
    await importModule('essence-settings', {
      weaponOwnership: { wpn_pistol_0008: true },
      essenceStatus: { wpn_pistol_0008: true },
      weaponNotes: {},
      customWeapons: [],
    })

    const state = useEssenceSettingsStore.getState()
    expect(state.accounts.map((a) => a.id)).toEqual(['acc_a', 'acc_b'])
    expect(state.accounts[0].weaponOwnership).toEqual({ wpn_pistol_0008: true })
    expect(state.accounts[1].weaponOwnership).toEqual({ wpn_lance_0010: true })
    expect(state.weaponOwnership).toEqual({ wpn_pistol_0008: true })
  })

  it('imports into an explicitly selected account when asked', async () => {
    const exported = projectEssenceSettingsForExport(readModule('essence-settings'))!

    await importModule('essence-settings', exported, { essence: { mode: 'active', accountId: 'acc_b' } })

    const state = useEssenceSettingsStore.getState()
    expect(state.accounts.map((a) => a.id)).toEqual(['acc_a', 'acc_b'])
    expect(state.accounts[0].weaponOwnership).toEqual({ wpn_claym_0017: true })
    expect(state.accounts[1].weaponOwnership).toEqual({ wpn_claym_0017: true })
    expect(state.activeAccountId).toBe('acc_a')
  })
})

describe('importModule: unknown module', () => {
  it('is a no-op', async () => {
    await importModule('not-a-module', { anything: true })
    await importModule('growth-planner', null)
    expect(localStorage.getItem('not-a-module')).toBeNull()
  })
})
