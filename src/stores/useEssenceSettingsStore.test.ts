import { describe, expect, it } from 'vitest'
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

  it('defaults the per-account weapon selection switch to on', () => {
    expect(normalizeEssenceSettingsFlags(undefined).separateSelectionPerAccount).toBe(true)
    expect(
      normalizeEssenceSettingsFlags({ separateSelectionPerAccount: false })
        .separateSelectionPerAccount,
    ).toBe(false)
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

  it('removing a custom weapon purges its selections from every account', () => {
    resetStore()
    const store = useEssenceSettingsStore.getState()
    const secondId = store.addAccount('B')!
    store.addCustomWeapon({ id: 'custom-test', name: '测试武器', rarity: 5, type: 'claymore', primaryStat: 'attack', elementalDamage: 'physical', specialAbility: '', chars: [] })
    useEssenceSettingsStore.getState().setAccountSelection(store.accounts[0].id, ['custom-test', 'wpn_claym_0017'])
    useEssenceSettingsStore.getState().setAccountSelection(secondId, ['custom-test'])

    useEssenceSettingsStore.getState().removeCustomWeapon('custom-test')

    const next = useEssenceSettingsStore.getState()
    expect(next.accounts[0].selectedWeaponIds).toEqual(['wpn_claym_0017'])
    expect(next.accounts[1].selectedWeaponIds).toEqual([])
  })

  it('stores a selection per account and ignores unknown account ids', () => {
    resetStore()
    const store = useEssenceSettingsStore.getState()
    const firstId = store.accounts[0].id
    const secondId = store.addAccount('B')!

    useEssenceSettingsStore.getState().setAccountSelection(firstId, ['wpn_bogus', 'wpn_claym_0017', 'wpn_claym_0017'])
    const afterFirst = useEssenceSettingsStore.getState().accounts
    // Unknown ids and duplicates are dropped; the other account is untouched.
    expect(afterFirst[0].selectedWeaponIds).toEqual(['wpn_claym_0017'])
    expect(afterFirst[1].selectedWeaponIds).toEqual([])

    // An id that no longer exists must NOT fall back to the active account.
    useEssenceSettingsStore.getState().setAccountSelection('acc_missing', ['wpn_sword_0012'])
    const afterMissing = useEssenceSettingsStore.getState().accounts
    expect(afterMissing[0].selectedWeaponIds).toEqual(['wpn_claym_0017'])
    expect(afterMissing[1].selectedWeaponIds).toEqual([])
    expect(secondId).toBe(afterMissing[1].id)
  })

  it('leaves the account list reference untouched when the selection is unchanged', () => {
    resetStore()
    const firstId = useEssenceSettingsStore.getState().accounts[0].id
    useEssenceSettingsStore.getState().setAccountSelection(firstId, ['wpn_claym_0017'])
    const before = useEssenceSettingsStore.getState().accounts

    useEssenceSettingsStore.getState().setAccountSelection(firstId, ['wpn_claym_0017'])

    // Same reference = no needless persist write on every toggle.
    expect(useEssenceSettingsStore.getState().accounts).toBe(before)
  })

  it('applyAccounts replaces profiles and keeps the active id when it survives', () => {
    resetStore()
    const state = useEssenceSettingsStore.getState()
    state.applyAccounts([
      { id: 'acc_x', name: 'X', weaponOwnership: { 'wpn_claym_0017': true }, essenceStatus: {}, weaponNotes: {}, selectedWeaponIds: [] },
      { id: 'acc_y', name: 'Y', weaponOwnership: {}, essenceStatus: {}, weaponNotes: {}, selectedWeaponIds: [] },
    ])
    const next = useEssenceSettingsStore.getState()
    expect(next.accounts.length).toBe(2)
    // currentId was not in the incoming list → first account becomes active
    expect(next.activeAccountId).toBe('acc_x')
    expect(next.weaponOwnership['wpn_claym_0017']).toBe(true)
  })
})
