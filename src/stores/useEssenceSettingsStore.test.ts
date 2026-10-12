// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { normalizeEssenceSettingsFlags, useEssenceSettingsStore } from './useEssenceSettingsStore'

describe('normalizeEssenceSettingsFlags', () => {
  it('defaults both three-star filters on and split ownership subsettings off', () => {
    const flags = normalizeEssenceSettingsFlags(undefined)

    expect(flags.hideThreeStarWeaponsList).toBe(true)
    expect(flags.hideThreeStarWeaponsPlans).toBe(true)
    expect(flags.onlyHideWhenBothOwnedList).toBe(false)
    expect(flags.onlyHideWhenBothOwnedPlans).toBe(false)
  })

  it('keeps list and plan settings independent and ignores the removed shared key', () => {
    const flags = normalizeEssenceSettingsFlags({
      hideThreeStarWeaponsList: false,
      hideThreeStarWeaponsPlans: true,
      onlyHideWhenBothOwnedList: true,
      onlyHideWhenBothOwnedPlans: false,
      onlyHideWhenBothOwned: true,
    })

    expect(flags.hideThreeStarWeaponsList).toBe(false)
    expect(flags.hideThreeStarWeaponsPlans).toBe(true)
    expect(flags.onlyHideWhenBothOwnedList).toBe(true)
    expect(flags.onlyHideWhenBothOwnedPlans).toBe(false)
    expect('onlyHideWhenBothOwned' in flags).toBe(false)
  })

  it('falls back from corrupted flag values without disturbing valid flags', () => {
    const flags = normalizeEssenceSettingsFlags({
      hideFourStarWeaponsList: false,
      hideThreeStarWeaponsList: 'false',
    })

    expect(flags.hideFourStarWeaponsList).toBe(false)
    expect(flags.hideThreeStarWeaponsList).toBe(true)
  })
})

it('persists and normalizes hidden acquisition categories independently for list and plans', () => {
  resetStore()
  const store = useEssenceSettingsStore.getState()
  store.setHiddenAcquisitionCategories('list', ['gacha', 'gacha', 1 as unknown as string])
  store.setHiddenAcquisitionCategories('plans', ['battlePass'])
  expect(useEssenceSettingsStore.getState().hiddenAcquisitionCategoriesList).toEqual(['gacha'])
  expect(useEssenceSettingsStore.getState().hiddenAcquisitionCategoriesPlans).toEqual(['battlePass'])
})

/** Reset the store to a pristine single-account state before each test. */
function resetStore() {
  useEssenceSettingsStore.getState().resetAllSettings()
}

describe('MaaEnd essence marks import', () => {
  it('previews a batch without publishing or persisting any changes', () => {
    resetStore()
    const store = useEssenceSettingsStore.getState()
    store.setEssenceStatus('wpn_sword_0016', true)
    const before = useEssenceSettingsStore.getState()
    const storageBefore = localStorage.getItem('essence-settings')
    expect(before.previewEssenceMarks(before.activeAccountId, ['wpn_sword_0012'])).toMatchObject({ added: ['wpn_sword_0012'], retainedMissing: ['wpn_sword_0016'] })
    expect(useEssenceSettingsStore.getState()).toBe(before)
    expect(localStorage.getItem('essence-settings')).toBe(storageBefore)
  })
  it('adds scanned marks while preserving old marks, custom weapons and other account data', () => {
    resetStore()
    const store = useEssenceSettingsStore.getState()
    const accountId = store.activeAccountId
    store.addCustomWeapon({ id: 'custom-import', name: 'Custom', rarity: 6, type: '单手剑', primaryStat: null, elementalDamage: null, specialAbility: null, chars: [] })
    store.setEssenceStatus('wpn_sword_0016', true)
    store.setEssenceStatus('custom-import', true)
    store.setWeaponOwnership('wpn_sword_0016', true)
    store.setWeaponNote('wpn_sword_0016', 'Keep this note')
    const otherId = store.addAccount('Other')!
    store.setEssenceStatus('wpn_sword_0001', true)
    store.setActiveAccount(accountId)
    const before = useEssenceSettingsStore.getState()
    const other = before.accounts.find((account) => account.id === otherId)

    const report = before.importEssenceMarks(accountId, ['wpn_sword_0012'])

    expect(report).toMatchObject({
      accountId,
      added: ['wpn_sword_0012'],
      consistent: [],
      retainedMissing: ['wpn_sword_0016'],
      retainedCustom: ['custom-import'],
    })
    const after = useEssenceSettingsStore.getState()
    expect(after.essenceStatus).toEqual({ wpn_sword_0016: true, 'custom-import': true, wpn_sword_0012: true })
    expect(after.accounts.find((account) => account.id === accountId)?.essenceStatus).toBe(after.essenceStatus)
    expect(after.accounts.find((account) => account.id === otherId)).toBe(other)
    expect(after.weaponOwnership).toBe(before.weaponOwnership)
    expect(after.weaponNotes).toBe(before.weaponNotes)
    expect(after.customWeapons).toBe(before.customWeapons)
    expect(after.hideEssenceOwnedWeaponsList).toBe(before.hideEssenceOwnedWeaponsList)
    expect(after.hideEssenceOwnedWeaponsPlans).toBe(before.hideEssenceOwnedWeaponsPlans)
  })

  it('reports repeated scans and empty scans without clearing any existing mark', () => {
    resetStore()
    const store = useEssenceSettingsStore.getState()
    store.setEssenceStatus('wpn_sword_0016', true)
    const first = store.importEssenceMarks(store.activeAccountId, ['wpn_sword_0012', 'wpn_sword_0012'])
    expect(first?.added).toEqual(['wpn_sword_0012'])
    const state = useEssenceSettingsStore.getState()
    const repeated = state.importEssenceMarks(state.activeAccountId, ['wpn_sword_0012'])
    expect(repeated).toMatchObject({ added: [], consistent: ['wpn_sword_0012'], retainedMissing: ['wpn_sword_0016'] })
    expect(useEssenceSettingsStore.getState()).toBe(state)

    expect(state.importEssenceMarks(state.activeAccountId, [])).toMatchObject({
      added: [], consistent: [], retainedMissing: ['wpn_sword_0016', 'wpn_sword_0012'],
    })
    expect(useEssenceSettingsStore.getState()).toBe(state)
  })

  it('rejects a switched or removed account and never redirects imports to another account', () => {
    resetStore()
    const store = useEssenceSettingsStore.getState()
    const firstId = store.activeAccountId
    store.addAccount('Other')
    const switched = useEssenceSettingsStore.getState()
    expect(switched.importEssenceMarks(firstId, ['wpn_sword_0012'])).toBeNull()
    expect(useEssenceSettingsStore.getState()).toBe(switched)
    store.removeAccount(firstId)
    const removed = useEssenceSettingsStore.getState()
    expect(removed.importEssenceMarks(firstId, ['wpn_sword_0012'])).toBeNull()
    expect(useEssenceSettingsStore.getState()).toBe(removed)
  })

  it('publishes the complete batch with synchronized account and active marks', () => {
    resetStore()
    const updates: Record<string, boolean>[] = []
    const unsubscribe = useEssenceSettingsStore.subscribe((state) => {
      expect(state.accounts.find((account) => account.id === state.activeAccountId)?.essenceStatus).toBe(state.essenceStatus)
      updates.push(state.essenceStatus)
    })
    const store = useEssenceSettingsStore.getState()
    store.importEssenceMarks(store.activeAccountId, ['wpn_sword_0012', 'wpn_sword_0016', 'wpn_future_9999'])
    unsubscribe()
    expect(updates).toEqual([{ wpn_sword_0012: true, wpn_sword_0016: true }])
  })

  it('restores imported marks and the batch action when a fresh store loads persisted data', async () => {
    resetStore()
    const store = useEssenceSettingsStore.getState()
    store.importEssenceMarks(store.activeAccountId, ['wpn_sword_0012'])
    vi.resetModules()
    const { useEssenceSettingsStore: restored } = await import('./useEssenceSettingsStore')
    await restored.persist.rehydrate()
    expect(restored.getState().essenceStatus).toEqual({ wpn_sword_0012: true })
    expect(restored.getState().accounts[0].essenceStatus).toBe(restored.getState().essenceStatus)
    expect(restored.getState().previewEssenceMarks(restored.getState().activeAccountId, ['wpn_sword_0016'])?.added).toEqual(['wpn_sword_0016'])
    expect(restored.getState().importEssenceMarks(restored.getState().activeAccountId, ['wpn_sword_0016'])?.added).toEqual(['wpn_sword_0016'])
  })
})

describe('useEssenceSettingsStore — game accounts', () => {
  it('starts with a single default account and mirrors its (empty) marks', () => {
    resetStore()
    const state = useEssenceSettingsStore.getState()
    expect(state.accounts.length).toBe(1)
    expect(state.activeAccountId).toBe(state.accounts[0].id)
    expect(state.weaponOwnership).toBe(state.accounts[0].weaponOwnership)
  })

  it('adds an account, switches to it, and keeps marks independent', () => {
    resetStore()
    const { setWeaponOwnership, addAccount, setActiveAccount } = useEssenceSettingsStore.getState()
    setWeaponOwnership('wpn_claym_0017', true)

    const secondId = addAccount('小号')!
    const state = useEssenceSettingsStore.getState()
    expect(state.accounts.length).toBe(2)
    expect(state.activeAccountId).toBe(secondId)
    // New account has no marks, even though account 1 marked a weapon.
    expect(state.weaponOwnership['wpn_claym_0017']).toBeUndefined()

    setWeaponOwnership('wpn_funnel_0001', true)
    setActiveAccount(state.accounts[0].id)
    const first = useEssenceSettingsStore.getState()
    expect(first.weaponOwnership['wpn_claym_0017']).toBe(true)
    expect(first.weaponOwnership['wpn_funnel_0001']).toBeUndefined()

    setActiveAccount(secondId)
    const second = useEssenceSettingsStore.getState()
    expect(second.weaponOwnership['wpn_claym_0017']).toBeUndefined()
    expect(second.weaponOwnership['wpn_funnel_0001']).toBe(true)
  })

  it('renames an account without touching its marks', () => {
    resetStore()
    const state = useEssenceSettingsStore.getState()
    const id = state.accounts[0].id
    useEssenceSettingsStore.getState().setWeaponOwnership('wpn_claym_0017', true)
    useEssenceSettingsStore.getState().renameAccount(id, '主号')
    const next = useEssenceSettingsStore.getState()
    expect(next.accounts[0].name).toBe('主号')
    expect(next.accounts[0].weaponOwnership['wpn_claym_0017']).toBe(true)
  })

  it('refuses to delete the last remaining account', () => {
    resetStore()
    const state = useEssenceSettingsStore.getState()
    const id = state.accounts[0].id
    useEssenceSettingsStore.getState().removeAccount(id)
    const next = useEssenceSettingsStore.getState()
    expect(next.accounts.length).toBe(1)
    expect(next.accounts[0].id).toBe(id)
  })

  it('deleting the active account activates the first remaining one', () => {
    resetStore()
    const store = useEssenceSettingsStore.getState()
    const firstId = store.accounts[0].id
    const secondId = store.addAccount('B')!
    useEssenceSettingsStore.getState().setActiveAccount(firstId)
    useEssenceSettingsStore.getState().setWeaponOwnership('wpn_claym_0017', true)
    useEssenceSettingsStore.getState().setActiveAccount(secondId)
    useEssenceSettingsStore.getState().removeAccount(secondId)
    const next = useEssenceSettingsStore.getState()
    expect(next.accounts.length).toBe(1)
    expect(next.activeAccountId).toBe(firstId)
    expect(next.weaponOwnership['wpn_claym_0017']).toBe(true)
  })

  it('removing a custom weapon purges its marks from every account', () => {
    resetStore()
    const store = useEssenceSettingsStore.getState()
    const firstId = store.accounts[0].id
    const secondId = store.addAccount('B')!
    store.addCustomWeapon({ id: 'custom-test', name: '测试武器', rarity: 5, type: 'claymore', primaryStat: 'attack', elementalDamage: 'physical', specialAbility: '', chars: [] })
    useEssenceSettingsStore.getState().setWeaponOwnership('custom-test', true)
    useEssenceSettingsStore.getState().setActiveAccount(secondId)
    useEssenceSettingsStore.getState().setWeaponOwnership('custom-test', true)

    useEssenceSettingsStore.getState().removeCustomWeapon('custom-test')
    const next = useEssenceSettingsStore.getState()
    for (const account of next.accounts) {
      expect(account.weaponOwnership['custom-test']).toBeUndefined()
      expect(account.essenceStatus['custom-test']).toBeUndefined()
      expect(account.weaponNotes['custom-test']).toBeUndefined()
    }
    expect(next.weaponOwnership['custom-test']).toBeUndefined()
    expect(next.customWeapons.length).toBe(0)
    expect(next.accounts.some((a) => a.id === firstId)).toBe(true)
  })

  it('applyAccounts replaces profiles and keeps the active id when it survives', () => {
    resetStore()
    const state = useEssenceSettingsStore.getState()
    state.applyAccounts([
      { id: 'acc_x', name: 'X', weaponOwnership: { 'wpn_claym_0017': true }, essenceStatus: {}, weaponNotes: {} },
      { id: 'acc_y', name: 'Y', weaponOwnership: {}, essenceStatus: {}, weaponNotes: {} },
    ])
    const next = useEssenceSettingsStore.getState()
    expect(next.accounts.length).toBe(2)
    // currentId was not in the incoming list → first account becomes active
    expect(next.activeAccountId).toBe('acc_x')
    expect(next.weaponOwnership['wpn_claym_0017']).toBe(true)
  })
})
