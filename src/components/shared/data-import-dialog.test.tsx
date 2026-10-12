// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The planner stores kick off loadPlannerData() at module scope; stub it so the
// multi-MB generated dataset never enters the test run.
vi.mock('@/lib/planner/planner-data-loader', () => ({
  getCachedPlannerGameData: () => undefined,
  loadPlannerData: () => Promise.resolve({}),
}))

// Echo the key (plus interpolation values) so assertions can check both copy
// wiring and the computed numbers.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

const { DataImportDialog } = await import('./data-import-dialog')
const { prepareImport } = await import('@/lib/data-import')
const { useDataImportStore } = await import('@/stores/useDataImportStore')
const { useEssenceSettingsStore } = await import('@/stores/useEssenceSettingsStore')

function seedTwoAccounts() {
  useEssenceSettingsStore.setState({
    accounts: [
      {
        id: 'acc_a',
        name: '主号',
        weaponOwnership: { wpn_claym_0017: true },
        essenceStatus: { wpn_claym_0017: true },
        weaponNotes: {},
        selectedWeaponIds: [],
      },
      {
        id: 'acc_b',
        name: '小号',
        weaponOwnership: {},
        essenceStatus: {},
        weaponNotes: {},
        selectedWeaponIds: [],
      },
    ],
    activeAccountId: 'acc_a',
    weaponOwnership: { wpn_claym_0017: true },
    essenceStatus: { wpn_claym_0017: true },
    weaponNotes: {},
    customWeapons: [],
    // Local globals: a single-account import must leave every one of them alone.
    hiddenAcquisitionCategoriesList: ['local-keep'],
    hiddenAcquisitionCategoriesPlans: [],
    regionFirst: null,
    regionSecond: null,
    weaponFilterCollapsed: false,
    hiddenWeaponsCollapsed: true,
    autoSyncEnabled: true,
    notifyOnSync: false,
    notifyOnPull: false,
  })
}

/** Mirror what the two entry points do: parse first, then queue the request. */
async function openImport(fileName: string, payload: unknown) {
  const prepared = await prepareImport(payload)
  useDataImportStore.getState().requestImport(fileName, prepared)
}

/**
 * Pick an option in the Nth Select of the dialog.
 *
 * Base UI only commits a mouse click on an item that is highlighted, and jsdom
 * has no layout to highlight one — a touch tap is the documented path that skips
 * that requirement, so drive items as taps here.
 */
function selectOption(triggerIndex: number, optionName: RegExp | string) {
  const trigger = screen.getAllByRole('combobox')[triggerIndex]
  fireEvent.pointerDown(trigger, { button: 0 })
  fireEvent.mouseDown(trigger, { button: 0 })
  fireEvent.click(trigger)
  const option = screen.getByRole('option', { name: optionName })
  fireEvent.pointerDown(option, { pointerType: 'touch' })
  fireEvent.click(option)
}

const cepBackup = {
  version: 2,
  exportedAt: '2026-01-02T03:04:05.000Z',
  appVersion: '9.9.9',
  modules: {
    'essence-settings': {
      accounts: [
        { id: 'acc_f', name: '备份号', weaponOwnership: { wpn_lance_0010: true }, essenceStatus: {}, weaponNotes: {} },
      ],
      activeAccountId: 'acc_f',
      customWeapons: [],
    },
  },
}

const maaEndInventory = [
  { weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [6, 6, 3], count: 1 }] },
]

/** Two file accounts + globals, so restore vs single-account mode can be told apart. */
const twoAccountBackup = {
  version: 2,
  exportedAt: '2026-01-02T03:04:05.000Z',
  modules: {
    'essence-settings': {
      accounts: [
        { id: 'acc_f1', name: '备份一号', weaponOwnership: { wpn_lance_0010: true }, essenceStatus: {}, weaponNotes: {} },
        {
          id: 'acc_f2',
          name: '备份二号',
          weaponOwnership: { wpn_pistol_0008: true },
          essenceStatus: { wpn_pistol_0008: true },
          weaponNotes: {},
        },
      ],
      activeAccountId: 'acc_f2',
      customWeapons: [],
      hiddenAcquisitionCategoriesList: ['gacha'],
    },
  },
}

beforeEach(() => {
  localStorage.clear()
  useDataImportStore.setState({ request: null, errorKey: null, success: false })
  seedTwoAccounts()
})

afterEach(() => {
  cleanup()
})

describe('DataImportDialog: CEP backup', () => {
  it('shows the format and the active account, then restores every account', async () => {
    await openImport('cep-data-export.json', cepBackup)
    render(<DataImportDialog />)

    expect(screen.getByText('settings.importFormatCep')).not.toBeNull()
    // The active account is spelled out — it is what a single-account import hits.
    expect(screen.getByText('settings.importActiveAccount')).not.toBeNull()
    expect(screen.getByText('主号')).not.toBeNull()
    // A file with accounts offers the account-handling choice, defaulting to restore.
    expect(screen.getByText('settings.importAccountMode')).not.toBeNull()

    fireEvent.click(screen.getByText('settings.importConfirm'))

    await waitFor(() => expect(useDataImportStore.getState().request).toBeNull())
    const state = useEssenceSettingsStore.getState()
    expect(state.accounts.map((a) => a.id)).toEqual(['acc_f'])
    expect(state.activeAccountId).toBe('acc_f')
    expect(state.weaponOwnership).toEqual({ wpn_lance_0010: true })
    expect(useDataImportStore.getState().success).toBe(true)
  })
})

describe('DataImportDialog: MaaEND essence inventory', () => {
  it('asks which account to overwrite when several accounts exist', async () => {
    await openImport('essence_inventory.json', maaEndInventory)
    render(<DataImportDialog />)

    expect(screen.getByText('settings.importFormatMaaEnd')).not.toBeNull()
    expect(screen.getByText('settings.importTargetAccount')).not.toBeNull()
    expect(screen.getByText(/settings\.importMaaEndSummary/)).not.toBeNull()

    fireEvent.click(screen.getByText('settings.importConfirm'))

    await waitFor(() => expect(useDataImportStore.getState().request).toBeNull())
    const state = useEssenceSettingsStore.getState()
    // Default target is the active account; ownership and notes stay untouched.
    expect(state.essenceStatus).toEqual({ wpn_sword_0012: true })
    expect(state.weaponOwnership).toEqual({ wpn_claym_0017: true })
    expect(state.accounts[0].essenceStatus).toEqual({ wpn_sword_0012: true })
    expect(state.accounts[1].essenceStatus).toEqual({})
  })

  it('warns how many existing marks the replace clears', async () => {
    await openImport('essence_inventory.json', maaEndInventory)
    render(<DataImportDialog />)

    expect(screen.getByText(/"added":1,"removed":1/)).not.toBeNull()
  })

  it('skips the account picker for a single account', async () => {
    useEssenceSettingsStore.getState().removeAccount('acc_b')
    await openImport('essence_inventory.json', maaEndInventory)
    render(<DataImportDialog />)

    expect(screen.queryByText('settings.importTargetAccount')).toBeNull()
    expect(screen.getByText('主号')).not.toBeNull()
  })

  it('explains an empty inventory before wiping the marks', async () => {
    await openImport('essence_inventory.json', [])
    render(<DataImportDialog />)

    expect(screen.getByText('settings.importMaaEndEmpty')).not.toBeNull()
  })

  it('reports a malformed MaaEND file and blocks the confirm button', async () => {
    await openImport('essence_inventory.json', [
      { weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [7, 1, 1], count: 1 }] },
    ])
    render(<DataImportDialog />)

    expect(screen.getByText('settings.importFormatMaaEndInvalid')).not.toBeNull()
    expect((screen.getByText('settings.importConfirm') as HTMLButtonElement).disabled).toBe(true)
  })

  it('reports unknown weapons that will be skipped', async () => {
    await openImport('essence_inventory.json', [
      { weapon_ids: ['wpn_sword_0012', 'wpn_sword_9999'], essences: [{ levels: [6, 6, 3], count: 1 }] },
    ])
    render(<DataImportDialog />)

    expect(screen.getByText(/settings\.importMaaEndUnknownWeapons:.*"count":1/)).not.toBeNull()
    // The ids themselves are listed: a weapon missing from the dataset has no name.
    expect(screen.getByText('wpn_sword_9999')).not.toBeNull()
  })

  it('caps the unknown-id list and reports how many are hidden', async () => {
    const unknownIds = Array.from({ length: 25 }, (_, index) => `wpn_sword_9${String(index).padStart(3, '0')}`)
    await openImport('essence_inventory.json', [
      { weapon_ids: ['wpn_sword_0012', ...unknownIds], essences: [{ levels: [6, 6, 3], count: 1 }] },
    ])
    render(<DataImportDialog />)

    expect(screen.getByText('wpn_sword_9000')).not.toBeNull()
    expect(screen.queryByText('wpn_sword_9024')).toBeNull()
    expect(screen.getByText(/settings\.importMaaEndUnknownWeaponsMore:.*"count":5/)).not.toBeNull()
  })
})

describe('DataImportDialog: account handling', () => {
  it('restores the file globals in full-restore mode', async () => {
    await openImport('cep-data-export.json', twoAccountBackup)
    render(<DataImportDialog />)

    fireEvent.click(screen.getByText('settings.importConfirm'))

    await waitFor(() => expect(useDataImportStore.getState().request).toBeNull())
    const state = useEssenceSettingsStore.getState()
    expect(state.accounts.map((a) => a.id)).toEqual(['acc_f1', 'acc_f2'])
    expect(state.hiddenAcquisitionCategoriesList).toEqual(['gacha'])
  })

  it('warns when the file was exported by a newer app version', async () => {
    await openImport('cep-data-export.json', { ...twoAccountBackup, version: 9 })
    render(<DataImportDialog />)

    expect(screen.getByText(/settings\.importNewerVersionWarning:.*"version":9/)).not.toBeNull()
  })

  it('offers file-account and local-account pickers in single-account mode', async () => {
    await openImport('cep-data-export.json', twoAccountBackup)
    render(<DataImportDialog />)

    // The mode selector defaults to a full restore.
    selectOption(0, 'settings.importModeActive')

    expect(screen.getByText('settings.importSourceAccount')).not.toBeNull()
    expect(screen.getByText('settings.importTargetAccount')).not.toBeNull()
    // Source defaults to the file's own active account.
    expect(screen.getAllByText('备份二号').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText('settings.importConfirm'))

    await waitFor(() => expect(useDataImportStore.getState().request).toBeNull())
    const state = useEssenceSettingsStore.getState()
    // The file accounts are NOT adopted, only their marks.
    expect(state.accounts.map((a) => a.id)).toEqual(['acc_a', 'acc_b'])
    expect(state.weaponOwnership).toEqual({ wpn_pistol_0008: true })
    expect(state.essenceStatus).toEqual({ wpn_pistol_0008: true })
    // globals stay untouched in single-account mode
    expect(state.hiddenAcquisitionCategoriesList).toEqual(['local-keep'])
  })

  it('imports the chosen file account into the chosen local account', async () => {
    await openImport('cep-data-export.json', twoAccountBackup)
    render(<DataImportDialog />)

    selectOption(0, 'settings.importModeActive')
    // Source: the other file account; target: the second local account.
    selectOption(1, /备份一号/)
    selectOption(2, '小号')

    fireEvent.click(screen.getByText('settings.importConfirm'))

    await waitFor(() => expect(useDataImportStore.getState().request).toBeNull())
    const state = useEssenceSettingsStore.getState()
    expect(state.accounts[1].weaponOwnership).toEqual({ wpn_lance_0010: true })
    expect(state.accounts[1].essenceStatus).toEqual({})
    // The active account is untouched, and the active mirrors stay put.
    expect(state.accounts[0].weaponOwnership).toEqual({ wpn_claym_0017: true })
    expect(state.weaponOwnership).toEqual({ wpn_claym_0017: true })
  })

  it('imports a legacy flat file into a chosen account and says so', async () => {
    await openImport('cep-data-export.json', {
      version: 1,
      modules: {
        'essence-settings': {
          weaponOwnership: { wpn_lance_0010: true },
          essenceStatus: {},
          weaponNotes: {},
          customWeapons: [],
        },
      },
    })
    render(<DataImportDialog />)

    expect(screen.getByText('settings.importNoAccountsNote')).not.toBeNull()
    // No accounts in the file → no mode selector, but the target is selectable.
    expect(screen.queryByText('settings.importAccountMode')).toBeNull()
    expect(screen.getByText('settings.importTargetAccount')).not.toBeNull()

    fireEvent.click(screen.getByText('settings.importConfirm'))

    await waitFor(() => expect(useDataImportStore.getState().request).toBeNull())
    const state = useEssenceSettingsStore.getState()
    expect(state.weaponOwnership).toEqual({ wpn_lance_0010: true })
    expect(state.accounts[0].weaponOwnership).toEqual({ wpn_lance_0010: true })
  })
})

describe('DataImportDialog: unrecognized file', () => {
  it('shows the format error and disables the import', async () => {
    await openImport('random.json', { hello: 'world' })
    render(<DataImportDialog />)

    expect(screen.getByText('settings.importFormatUnknown')).not.toBeNull()
    expect(screen.getByText('settings.importInvalidFormat')).not.toBeNull()
    expect((screen.getByText('settings.importConfirm') as HTMLButtonElement).disabled).toBe(true)
  })
})
