// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { swapAccountSelection, useMatrixStore } from './useMatrixStore'
import { useEssenceSettingsStore } from './useEssenceSettingsStore'
import type { EssenceAccount } from '@/types/essence-settings'

function account(id: string, selectedWeaponIds: string[] = []): EssenceAccount {
  return {
    id,
    name: id.toUpperCase(),
    weaponOwnership: {},
    essenceStatus: {},
    weaponNotes: {},
    selectedWeaponIds,
  }
}

function seed(accounts: EssenceAccount[], activeAccountId: string, separate = true) {
  useEssenceSettingsStore.setState({
    accounts,
    activeAccountId,
    separateSelectionPerAccount: separate,
  })
}

function storedSelection(accountId: string): string[] {
  return (
    useEssenceSettingsStore.getState().accounts.find((a) => a.id === accountId)
      ?.selectedWeaponIds ?? []
  )
}

describe('per-account weapon selection', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    useMatrixStore.setState({ selectedWeaponIds: [], plansMap: {}, planOrder: [], plansStale: false })
    seed([account('acc_a'), account('acc_b')], 'acc_a')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useEssenceSettingsStore.setState({
      accounts: [account('acc_a')],
      activeAccountId: 'acc_a',
      separateSelectionPerAccount: true,
    })
    useMatrixStore.setState({ selectedWeaponIds: [] })
  })

  it('records the selection on the active account', () => {
    useMatrixStore.setState({ selectedWeaponIds: ['wpn_claym_0017'] })
    expect(storedSelection('acc_a')).toEqual(['wpn_claym_0017'])
    expect(storedSelection('acc_b')).toEqual([])
  })

  it('swaps the selection when the active account changes', () => {
    seed([account('acc_a', ['wpn_sword_0012']), account('acc_b', ['wpn_lance_0010'])], 'acc_a')
    useMatrixStore.setState({ selectedWeaponIds: ['wpn_claym_0017'] })

    useEssenceSettingsStore.getState().setActiveAccount('acc_b')

    // Outgoing account keeps what the user just had; incoming loads its own list.
    expect(storedSelection('acc_a')).toEqual(['wpn_claym_0017'])
    expect(useMatrixStore.getState().selectedWeaponIds).toEqual(['wpn_lance_0010'])
  })

  it('drops ids that no longer exist when loading an account', () => {
    seed(
      [
        account('acc_a', []),
        account('acc_b', ['wpn_claym_0017', 'wpn_unknown_9999', 'custom-deleted']),
      ],
      'acc_a',
    )

    swapAccountSelection('acc_a', 'acc_b')

    expect(useMatrixStore.getState().selectedWeaponIds).toEqual(['wpn_claym_0017'])
  })

  it('never writes a swap back into the incoming account when the source is gone', () => {
    seed([account('acc_b', ['wpn_lance_0010'])], 'acc_a')
    useMatrixStore.setState({ selectedWeaponIds: ['wpn_claym_0017'] })

    swapAccountSelection('acc_a', 'acc_b')

    expect(storedSelection('acc_b')).toEqual(['wpn_lance_0010'])
    expect(useMatrixStore.getState().selectedWeaponIds).toEqual(['wpn_lance_0010'])
  })

  it('shares one selection across accounts while the switch is off', () => {
    seed([account('acc_a', ['wpn_sword_0012']), account('acc_b', ['wpn_lance_0010'])], 'acc_a', false)
    useMatrixStore.setState({ selectedWeaponIds: ['wpn_claym_0017'] })

    useEssenceSettingsStore.getState().setActiveAccount('acc_b')

    expect(useMatrixStore.getState().selectedWeaponIds).toEqual(['wpn_claym_0017'])
    // Nothing is maintained per account while the feature is off.
    expect(storedSelection('acc_a')).toEqual(['wpn_sword_0012'])
    expect(storedSelection('acc_b')).toEqual(['wpn_lance_0010'])
  })

  it('keeps the current selection when the switch is turned on', () => {
    seed([account('acc_a'), account('acc_b')], 'acc_a', false)
    useMatrixStore.setState({ selectedWeaponIds: ['wpn_claym_0017'] })

    useEssenceSettingsStore.setState({ separateSelectionPerAccount: true })

    expect(storedSelection('acc_a')).toEqual(['wpn_claym_0017'])
    expect(useMatrixStore.getState().selectedWeaponIds).toEqual(['wpn_claym_0017'])
  })
})
