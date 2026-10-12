// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { applyCepEssenceSettings, applyMaaEndEssence, listFileAccounts } from './apply'

/** Seed two game accounts: A owns a weapon, B owns an essence mark. */
function seedTwoAccounts() {
  useEssenceSettingsStore.setState({
    accounts: [
      {
        id: 'acc_a',
        name: 'A',
        weaponOwnership: { wpn_claym_0017: true },
        essenceStatus: { wpn_claym_0017: true },
        weaponNotes: { wpn_claym_0017: 'note-a' },
      },
      {
        id: 'acc_b',
        name: 'B',
        weaponOwnership: {},
        essenceStatus: { wpn_sword_0012: true },
        weaponNotes: {},
      },
    ],
    activeAccountId: 'acc_a',
    weaponOwnership: { wpn_claym_0017: true },
    essenceStatus: { wpn_claym_0017: true },
    weaponNotes: { wpn_claym_0017: 'note-a' },
    customWeapons: [],
    regionFirst: null,
    regionSecond: null,
  })
}

function persistedEssence(): Record<string, unknown> {
  const raw = localStorage.getItem('essence-settings')
  return raw ? (JSON.parse(raw) as { state: Record<string, unknown> }).state : {}
}

beforeEach(() => {
  localStorage.clear()
  seedTwoAccounts()
})

describe('applyCepEssenceSettings: restore mode (a backup round-trip)', () => {
  const file = {
    accounts: [
      { id: 'acc_f1', name: 'F1', weaponOwnership: { wpn_lance_0010: true }, essenceStatus: {}, weaponNotes: {} },
      {
        id: 'acc_f2',
        name: 'F2',
        weaponOwnership: { wpn_pistol_0008: true },
        essenceStatus: { wpn_pistol_0008: true },
        weaponNotes: { wpn_pistol_0008: 'n' },
      },
    ],
    activeAccountId: 'acc_f2',
    customWeapons: [],
    regionFirst: 'region_a',
  }

  it('replaces every account and mirrors the file active account', () => {
    applyCepEssenceSettings(file)

    const state = useEssenceSettingsStore.getState()
    expect(state.accounts.map((a) => a.id)).toEqual(['acc_f1', 'acc_f2'])
    expect(state.activeAccountId).toBe('acc_f2')
    // flat mirrors follow the restored active account
    expect(state.weaponOwnership).toEqual({ wpn_pistol_0008: true })
    expect(state.essenceStatus).toEqual({ wpn_pistol_0008: true })
    expect(state.weaponNotes).toEqual({ wpn_pistol_0008: 'n' })
    expect(state.regionFirst).toBe('region_a')
  })

  it('persists the restored accounts so a reload cannot revert them', () => {
    applyCepEssenceSettings(file)

    const persisted = persistedEssence()
    expect((persisted.accounts as { id: string }[]).map((a) => a.id)).toEqual(['acc_f1', 'acc_f2'])
    expect(persisted.activeAccountId).toBe('acc_f2')
    expect(persisted.weaponOwnership).toEqual({ wpn_pistol_0008: true })
  })

  it('falls back to the first account when the file active id is unknown', () => {
    applyCepEssenceSettings({ ...file, activeAccountId: 'acc_missing' })

    const state = useEssenceSettingsStore.getState()
    expect(state.activeAccountId).toBe('acc_f1')
    expect(state.weaponOwnership).toEqual({ wpn_lance_0010: true })
  })
})

describe('applyCepEssenceSettings: single-account mode', () => {
  const file = {
    accounts: [
      { id: 'acc_f1', name: 'F1', weaponOwnership: { wpn_lance_0010: true }, essenceStatus: {}, weaponNotes: {} },
      {
        id: 'acc_f2',
        name: 'F2',
        weaponOwnership: { wpn_pistol_0008: true },
        essenceStatus: { wpn_pistol_0008: true },
        weaponNotes: { wpn_pistol_0008: 'n' },
      },
    ],
    activeAccountId: 'acc_f2',
  }

  it('overwrites only the selected account and keeps the other one intact', () => {
    applyCepEssenceSettings(file, { mode: 'active', accountId: 'acc_b' })

    const state = useEssenceSettingsStore.getState()
    expect(state.accounts.map((a) => a.id)).toEqual(['acc_a', 'acc_b'])
    expect(state.accounts[0].weaponOwnership).toEqual({ wpn_claym_0017: true })
    expect(state.accounts[1].weaponOwnership).toEqual({ wpn_pistol_0008: true })
    expect(state.accounts[1].essenceStatus).toEqual({ wpn_pistol_0008: true })
    // the active account is NOT switched by an import into another account
    expect(state.activeAccountId).toBe('acc_a')
    expect(state.weaponOwnership).toEqual({ wpn_claym_0017: true })
  })

  it('refreshes the flat mirrors when the selected account is the active one', () => {
    applyCepEssenceSettings(file, { mode: 'active', accountId: 'acc_a' })

    const state = useEssenceSettingsStore.getState()
    expect(state.activeAccountId).toBe('acc_a')
    expect(state.weaponOwnership).toEqual({ wpn_pistol_0008: true })
    expect(state.weaponNotes).toEqual({ wpn_pistol_0008: 'n' })
    expect(state.accounts[1].essenceStatus).toEqual({ wpn_sword_0012: true })
  })
})

describe('applyCepEssenceSettings: legacy payload without accounts', () => {
  it('folds the flat marks into the active account', () => {
    applyCepEssenceSettings({
      weaponOwnership: { wpn_lance_0010: true },
      essenceStatus: { wpn_lance_0010: true },
      weaponNotes: {},
    })

    const state = useEssenceSettingsStore.getState()
    expect(state.accounts.map((a) => a.id)).toEqual(['acc_a', 'acc_b'])
    expect(state.accounts[1].essenceStatus).toEqual({ wpn_sword_0012: true })
    expect(state.weaponOwnership).toEqual({ wpn_lance_0010: true })
    expect(state.accounts[0].weaponOwnership).toEqual({ wpn_lance_0010: true })
  })

  it('routes the flat marks into an explicitly selected account', () => {
    applyCepEssenceSettings(
      { weaponOwnership: { wpn_lance_0010: true }, essenceStatus: {}, weaponNotes: {} },
      { mode: 'active', accountId: 'acc_b' },
    )

    const state = useEssenceSettingsStore.getState()
    expect(state.accounts[0].weaponOwnership).toEqual({ wpn_claym_0017: true })
    expect(state.accounts[1].weaponOwnership).toEqual({ wpn_lance_0010: true })
  })
})

describe('applyCepEssenceSettings: global preferences', () => {
  const file = {
    accounts: [
      { id: 'acc_f1', name: 'F1', weaponOwnership: { wpn_lance_0010: true }, essenceStatus: {}, weaponNotes: {} },
    ],
    activeAccountId: 'acc_f1',
    customWeapons: [],
    hiddenAcquisitionCategoriesList: ['gacha', 'gacha', ''],
    hiddenAcquisitionCategoriesPlans: ['battlePass'],
    weaponFilterCollapsed: true,
    hiddenWeaponsCollapsed: false,
    autoSyncEnabled: false,
    notifyOnSync: true,
    notifyOnPull: true,
    hideFourStarWeaponsList: false,
  }

  it('restores every exported global preference, not just the marks', () => {
    applyCepEssenceSettings(file)

    const state = useEssenceSettingsStore.getState()
    // deduped + blank entries dropped
    expect(state.hiddenAcquisitionCategoriesList).toEqual(['gacha'])
    expect(state.hiddenAcquisitionCategoriesPlans).toEqual(['battlePass'])
    expect(state.weaponFilterCollapsed).toBe(true)
    expect(state.hiddenWeaponsCollapsed).toBe(false)
    expect(state.autoSyncEnabled).toBe(false)
    expect(state.notifyOnSync).toBe(true)
    expect(state.notifyOnPull).toBe(true)
    expect(state.hideFourStarWeaponsList).toBe(false)
  })

  it('resets omitted globals to the app defaults (the file is the truth)', () => {
    applyCepEssenceSettings({
      accounts: file.accounts,
      activeAccountId: 'acc_f1',
      hiddenAcquisitionCategoriesList: ['gacha'],
      autoSyncEnabled: false,
    })

    const state = useEssenceSettingsStore.getState()
    expect(state.hiddenAcquisitionCategoriesList).toEqual(['gacha'])
    expect(state.hiddenAcquisitionCategoriesPlans).toEqual([])
    expect(state.weaponFilterCollapsed).toBe(false)
    expect(state.hiddenWeaponsCollapsed).toBe(true)
    expect(state.autoSyncEnabled).toBe(false)
    expect(state.notifyOnSync).toBe(false)
    expect(state.notifyOnPull).toBe(false)
  })

  it('persists restored globals through the store', () => {
    applyCepEssenceSettings(file)

    const persisted = persistedEssence()
    expect(persisted.hiddenAcquisitionCategoriesList).toEqual(['gacha'])
    expect(persisted.autoSyncEnabled).toBe(false)
    expect(persisted.weaponFilterCollapsed).toBe(true)
  })

  it('keeps the local globals when importing into a single account', () => {
    useEssenceSettingsStore.setState({
      customWeapons: [],
      regionFirst: 'region_local',
      regionSecond: null,
      hiddenAcquisitionCategoriesList: ['keep-list'],
      hiddenAcquisitionCategoriesPlans: ['keep-plans'],
      weaponFilterCollapsed: false,
      hiddenWeaponsCollapsed: true,
      autoSyncEnabled: true,
      notifyOnSync: false,
      notifyOnPull: false,
      hideFourStarWeaponsList: true,
    })

    applyCepEssenceSettings(file, { mode: 'active', accountId: 'acc_b' })

    const state = useEssenceSettingsStore.getState()
    // marks moved
    expect(state.accounts[1].weaponOwnership).toEqual({ wpn_lance_0010: true })
    // globals untouched
    expect(state.hiddenAcquisitionCategoriesList).toEqual(['keep-list'])
    expect(state.hiddenAcquisitionCategoriesPlans).toEqual(['keep-plans'])
    expect(state.weaponFilterCollapsed).toBe(false)
    expect(state.hiddenWeaponsCollapsed).toBe(true)
    expect(state.autoSyncEnabled).toBe(true)
    expect(state.notifyOnSync).toBe(false)
    expect(state.notifyOnPull).toBe(false)
    expect(state.hideFourStarWeaponsList).toBe(true)
    expect(state.regionFirst).toBe('region_local')
  })
})

describe('applyCepEssenceSettings: source account selection', () => {
  const file = {
    accounts: [
      { id: 'acc_f1', name: 'F1', weaponOwnership: { wpn_lance_0010: true }, essenceStatus: {}, weaponNotes: {} },
      {
        id: 'acc_f2',
        name: 'F2',
        weaponOwnership: { wpn_pistol_0008: true },
        essenceStatus: { wpn_pistol_0008: true },
        weaponNotes: { wpn_pistol_0008: 'n' },
      },
    ],
    activeAccountId: 'acc_f2',
  }

  it('reads the marks of the explicitly selected file account', () => {
    applyCepEssenceSettings(file, { mode: 'active', accountId: 'acc_b', sourceAccountId: 'acc_f1' })

    const state = useEssenceSettingsStore.getState()
    expect(state.accounts[1].weaponOwnership).toEqual({ wpn_lance_0010: true })
    expect(state.accounts[1].essenceStatus).toEqual({})
    expect(state.accounts[1].weaponNotes).toEqual({})
  })

  it('falls back to the file active account for an unknown source id', () => {
    applyCepEssenceSettings(file, { mode: 'active', accountId: 'acc_b', sourceAccountId: 'acc_nope' })

    expect(useEssenceSettingsStore.getState().accounts[1].weaponOwnership).toEqual({ wpn_pistol_0008: true })
  })

  it('resolves accounts without an id through their #index key', () => {
    const anonymous = {
      accounts: [
        { name: 'no-id', weaponOwnership: { wpn_lance_0010: true }, essenceStatus: {}, weaponNotes: {} },
        { id: 'acc_f2', name: 'F2', weaponOwnership: { wpn_pistol_0008: true }, essenceStatus: {}, weaponNotes: {} },
      ],
      activeAccountId: 'acc_f2',
    }

    applyCepEssenceSettings(anonymous, { mode: 'active', accountId: 'acc_b', sourceAccountId: '#0' })

    expect(useEssenceSettingsStore.getState().accounts[1].weaponOwnership).toEqual({ wpn_lance_0010: true })
  })
})

describe('listFileAccounts', () => {
  it('lists id, name and mark count for every account entry', () => {
    const accounts = listFileAccounts({
      accounts: [
        { id: 'acc_f1', name: 'F1', weaponOwnership: { wpn_lance_0010: true }, essenceStatus: {}, weaponNotes: {} },
        {
          id: 'acc_f2',
          name: 'F2',
          weaponOwnership: { wpn_pistol_0008: true },
          essenceStatus: { wpn_pistol_0008: true },
          weaponNotes: { wpn_pistol_0008: 'n' },
        },
      ],
    })

    expect(accounts).toEqual([
      { id: 'acc_f1', name: 'F1', markCount: 1 },
      { id: 'acc_f2', name: 'F2', markCount: 3 },
    ])
  })

  it('keys anonymous entries by index and skips non-object entries', () => {
    const accounts = listFileAccounts({
      accounts: ['junk', { name: 'no-id', essenceStatus: { wpn_lance_0010: true } }],
    })

    expect(accounts).toEqual([{ id: '#1', name: 'no-id', markCount: 1 }])
  })

  it('returns nothing for a legacy flat file without accounts', () => {
    expect(listFileAccounts({ weaponOwnership: { wpn_lance_0010: true } })).toEqual([])
    expect(listFileAccounts(null)).toEqual([])
  })
})

describe('applyMaaEndEssence', () => {
  it('replaces the essence marks of the active account and keeps ownership / notes', () => {
    applyMaaEndEssence(['wpn_funnel_0017'])

    const state = useEssenceSettingsStore.getState()
    // replace semantics: the pre-existing mark that is absent from the file is cleared
    expect(state.essenceStatus).toEqual({ wpn_funnel_0017: true })
    expect(state.weaponOwnership).toEqual({ wpn_claym_0017: true })
    expect(state.weaponNotes).toEqual({ wpn_claym_0017: 'note-a' })
    expect(state.accounts[0].essenceStatus).toEqual({ wpn_funnel_0017: true })
    expect(state.accounts[1].essenceStatus).toEqual({ wpn_sword_0012: true })
  })

  it('targets another account without touching the active one', () => {
    applyMaaEndEssence(['wpn_sword_0012', 'wpn_funnel_0017'], 'acc_b')

    const state = useEssenceSettingsStore.getState()
    expect(state.accounts[1].essenceStatus).toEqual({ wpn_sword_0012: true, wpn_funnel_0017: true })
    expect(state.accounts[0].essenceStatus).toEqual({ wpn_claym_0017: true })
    expect(state.essenceStatus).toEqual({ wpn_claym_0017: true })
  })

  it('clears the essence marks for an empty inventory', () => {
    applyMaaEndEssence([])

    const state = useEssenceSettingsStore.getState()
    expect(state.essenceStatus).toEqual({})
    expect(state.accounts[0].essenceStatus).toEqual({})
    expect(state.weaponOwnership).toEqual({ wpn_claym_0017: true })
  })

  it('persists the new marks through the store', () => {
    applyMaaEndEssence(['wpn_sword_0012'])

    expect(persistedEssence().essenceStatus).toEqual({ wpn_sword_0012: true })
    expect((persistedEssence().accounts as { essenceStatus: unknown }[])[0].essenceStatus).toEqual({ wpn_sword_0012: true })
  })
})
