// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

const { DataImportDialog } = await import('./data-import-dialog')
const { prepareImport } = await import('@/lib/data-import')
const { useDataImportStore } = await import('@/stores/useDataImportStore')
const { useEssenceSettingsStore } = await import('@/stores/useEssenceSettingsStore')
const { setAppToastHandler } = await import('@/lib/app-toast')
import type { AppToastEvent } from '@/lib/app-toast'

/** Import results are shown by the shared toast layer (SyncNotifier). */
const appToasts: AppToastEvent[] = []

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

/** v3.2.0 and earlier: no longer imported, only reported as unsupported. */
const maaEndLegacyInventory = [
  { weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [6, 6, 3], count: 1 }] },
]

/** wpn_sword_0012 + wpn_sword_0016 share this term set. */
const SWORD_TERMS = ['gat_passive_attr_will', 'gat_passive_attr_atk', 'gst_passive_tacafter']

function maaEndV1(overrides: Record<string, unknown> = {}) {
  return {
    format: 'maaend.essence_inventory',
    version: 1,
    account_id: 'uid_hash',
    updated_at: '2026-11-22T04:05:06Z',
    coverage: { flawless_gold: { complete_at: '2026-11-22T04:05:06Z' } },
    items: [{
      quality: 'flawless_gold',
      mark: 'lock',
      skills: SWORD_TERMS.map((id) => ({ id, level: 6 })),
    }],
    ...overrides,
  }
}

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
  appToasts.length = 0
  setAppToastHandler((event) => appToasts.push(event))
  seedTwoAccounts()
})

afterEach(() => {
  cleanup()
  setAppToastHandler(null)
})

describe('DataImportDialog: notification surface', () => {
  it('routes results through the shared toast instead of its own overlay', () => {
    render(<DataImportDialog />)

    act(() => useDataImportStore.getState().reportError('settings.importParseError'))
    expect(appToasts).toContainEqual({ tone: 'error', text: 'settings.importParseError' })
    // The key is consumed by the toast layer, so it cannot linger in the store.
    expect(useDataImportStore.getState().errorKey).toBeNull()

    act(() => useDataImportStore.getState().markSuccess())
    expect(appToasts).toContainEqual({ tone: 'success', text: 'settings.importSuccess' })
    expect(useDataImportStore.getState().success).toBe(false)

    // No second overlay at the toast position — that is what overlapped the
    // sync conflict notification.
    expect(document.querySelectorAll('.fixed.bottom-6.right-6')).toHaveLength(0)
  })
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
    expect(appToasts).toContainEqual({ tone: 'success', text: 'settings.importSuccess' })
  })
})

describe('DataImportDialog: MaaEND essence inventory', () => {
  it('asks which account to overwrite when several accounts exist', async () => {
    await openImport('uid_hash.json', maaEndV1())
    render(<DataImportDialog />)

    expect(screen.getByText(/settings\.importFormatMaaEndVersion:.*"version":1/)).not.toBeNull()
    expect(screen.getByText('settings.importTargetAccount')).not.toBeNull()
    expect(screen.getByText(/settings\.importMaaEndSummary/)).not.toBeNull()

    fireEvent.click(screen.getByText('settings.importConfirm'))

    await waitFor(() => expect(useDataImportStore.getState().request).toBeNull())
    const state = useEssenceSettingsStore.getState()
    // Default target is the active account; ownership and notes stay untouched.
    expect(state.essenceStatus).toEqual({ wpn_sword_0012: true, wpn_sword_0016: true })
    expect(state.weaponOwnership).toEqual({ wpn_claym_0017: true })
    expect(state.accounts[0].essenceStatus).toEqual({ wpn_sword_0012: true, wpn_sword_0016: true })
    expect(state.accounts[1].essenceStatus).toEqual({})
  })

  it('warns how many existing marks the replace clears', async () => {
    await openImport('uid_hash.json', maaEndV1())
    render(<DataImportDialog />)

    // Two weapons gain a mark, the pre-existing wpn_claym_0017 mark is cleared
    expect(screen.getByText(/"added":2,"removed":1/)).not.toBeNull()
  })

  it('skips the account picker for a single account', async () => {
    useEssenceSettingsStore.getState().removeAccount('acc_b')
    await openImport('uid_hash.json', maaEndV1())
    render(<DataImportDialog />)

    expect(screen.queryByText('settings.importTargetAccount')).toBeNull()
    expect(screen.getByText('主号')).not.toBeNull()
  })

  it('explains an empty complete inventory', async () => {
    await openImport('uid_hash.json', maaEndV1({ items: [] }))
    render(<DataImportDialog />)

    expect(screen.getByText('settings.importMaaEndEmpty')).not.toBeNull()
  })

  it('reports a malformed MAAEND file and blocks the confirm button', async () => {
    await openImport('uid_hash.json', maaEndV1({ items: [{ quality: 'flawless_gold', mark: 'lock' }] }))
    render(<DataImportDialog />)

    expect(screen.getByText('settings.importFormatMaaEndInvalid')).not.toBeNull()
    // The failing field still travels with the report, just not in the headline
    expect(screen.getByText('settings.importMaaEndInvalidHint')).not.toBeNull()
    expect((screen.getByText('settings.importConfirm') as HTMLButtonElement).disabled).toBe(true)
  })

  it('tells the user to re-export instead of importing the retired array format', async () => {
    await openImport('EssenceInventory.json', maaEndLegacyInventory)
    render(<DataImportDialog />)

    // Not "corrupted": the format was dropped on purpose, the file is fine
    expect(screen.getByText('settings.importMaaEndLegacyUnsupported')).not.toBeNull()
    expect(screen.queryByText(/settings\.importFormatMaaEndInvalid/)).toBeNull()
    expect((screen.getByText('settings.importConfirm') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByText('settings.importConfirm'))
    // Nothing was written
    expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({ wpn_claym_0017: true })
  })

  it('reports entries that map to no weapon', async () => {
    const unknown = ['gat_passive_attr_unknown', 'gat_passive_attr_atk', 'gst_passive_unknown']
    await openImport('uid_hash.json', maaEndV1({
      items: [
        ...maaEndV1().items,
        { quality: 'flawless_gold', mark: 'lock', skills: unknown.map((id) => ({ id, level: 6 })) },
      ],
    }))
    render(<DataImportDialog />)

    expect(screen.getByText(/settings\.importMaaEndUnknownEntries:.*"count":1/)).not.toBeNull()
    // The raw term ids are listed: an unmatched combo has no name in any locale
    expect(screen.getByText(unknown.join(' + '))).not.toBeNull()
  })

  it('reports skipped items, not just distinct unrecognised combos', async () => {
    const unknown = ['gat_passive_attr_unknown', 'gat_passive_attr_atk', 'gst_passive_unknown']
    const duplicate = { quality: 'flawless_gold', mark: 'lock', skills: unknown.map((id) => ({ id, level: 6 })) }
    await openImport('uid_hash.json', maaEndV1({ items: [...maaEndV1().items, duplicate, duplicate] }))
    render(<DataImportDialog />)

    // Two identical unusable essences: the count says 2, the list shows one combo
    expect(screen.getByText(/settings\.importMaaEndUnknownEntries:.*"count":2/)).not.toBeNull()
    expect(screen.getAllByText(unknown.join(' + '))).toHaveLength(1)
  })

  it('stops with an error instead of writing to another account', async () => {
    await openImport('uid_hash.json', maaEndV1())
    render(<DataImportDialog />)

    // The target profile disappears while the dialog is open (cloud refresh)
    useEssenceSettingsStore.getState().removeAccount('acc_a')
    fireEvent.click(screen.getByText('settings.importConfirm'))

    await waitFor(() => expect(appToasts).toContainEqual({ tone: 'error', text: 'settings.importApplyError' }))
    // Nothing was written anywhere
    expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({})
    expect(useDataImportStore.getState().success).toBe(false)
  })

  it('caps the unknown-entry list and reports how many are hidden', async () => {
    const unknownItems = Array.from({ length: 25 }, (_, index) => ({
      quality: 'flawless_gold',
      mark: 'lock',
      skills: ['gat_passive_attr_unknown', 'gat_passive_attr_atk', `gst_passive_x${index}`].map((id, i) => ({
        id,
        level: i === 2 ? 1 : 6,
      })),
    }))
    await openImport('uid_hash.json', maaEndV1({ items: unknownItems }))
    render(<DataImportDialog />)

    expect(screen.getByText(/settings\.importMaaEndUnknownEntries:.*"count":25/)).not.toBeNull()
    expect(screen.getAllByText(/gat_passive_attr_unknown/)).toHaveLength(20)
    expect(screen.getByText(/settings\.importMaaEndUnknownEntriesMore:.*"count":5/)).not.toBeNull()
  })

  it('imports a complete scan and shows its version + write time', async () => {
    await openImport('uid_hash.json', maaEndV1())
    render(<DataImportDialog />)

    expect(screen.getByText(/settings\.importMaaEndUpdatedAt:/)).not.toBeNull()
    expect(screen.getByText(/settings\.importMaaEndSummary:.*"weapons":2,"essences":1/)).not.toBeNull()

    fireEvent.click(screen.getByText('settings.importConfirm'))

    await waitFor(() => expect(useDataImportStore.getState().request).toBeNull())
    expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({
      wpn_sword_0012: true,
      wpn_sword_0016: true,
    })
  })

  it('only adds marks for a partial scan and says so', async () => {
    await openImport('uid_hash.json', maaEndV1({ coverage: { flawless_gold: { unread: 2 } } }))
    render(<DataImportDialog />)

    expect(screen.getByText('settings.importMaaEndIncomplete')).not.toBeNull()
    // No "clears N marks" warning: a partial scan never removes marks
    expect(screen.queryByText(/settings\.importMaaEndReplaceWarning/)).toBeNull()

    fireEvent.click(screen.getByText('settings.importConfirm'))

    await waitFor(() => expect(useDataImportStore.getState().request).toBeNull())
    // The pre-existing wpn_claym_0017 mark survives
    expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({
      wpn_claym_0017: true,
      wpn_sword_0012: true,
      wpn_sword_0016: true,
    })
  })

  it('offers copy + GitHub + other channels for a newer protocol file', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    await openImport('uid_hash.json', maaEndV1({ version: 2 }))
    render(<DataImportDialog />)

    // Two-way hint: update MaaEND, or this site is behind -> report it
    expect(screen.getByText('settings.importMaaEndNewerProtocolHint')).not.toBeNull()

    fireEvent.click(screen.getByText('common.copyReportInfo'))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const copied = String(writeText.mock.calls[0][0])
    expect(copied).toContain('unsupported_version')
    expect(copied).toContain('file v2 > site v1')
    expect(screen.getByText('common.reportCopied')).not.toBeNull()

    // GitHub issue is prefilled with the same diagnostics
    const issue = screen.getByText('common.reportToGithub').closest('a') as HTMLAnchorElement
    expect(issue.href).toContain('issues/new')
    expect(decodeURIComponent(issue.href)).toContain('unsupported_version')

    // Secondary channels, for users without a GitHub account
    expect(screen.getByText('feedback.forum')).not.toBeNull()
    expect(screen.getByText('feedback.qqGroup')).not.toBeNull()
    expect(screen.getByText('settings.importMaaEndFeedbackGuide')).not.toBeNull()
  })

  it('offers the same report path for a same-version structure failure', async () => {
    await openImport('uid_hash.json', maaEndV1({ items: [{ quality: 'flawless_gold', mark: 'lock' }] }))
    render(<DataImportDialog />)

    expect(screen.getByText('settings.importMaaEndInvalidHint')).not.toBeNull()
    const issue = screen.getByText('common.reportToGithub').closest('a') as HTMLAnchorElement
    expect(decodeURIComponent(issue.href)).toContain('items[0].skills')
  })

  it('names a newer MaaEND protocol instead of calling the file corrupted', async () => {
    await openImport('uid_hash.json', maaEndV1({ version: 2 }))
    render(<DataImportDialog />)

    expect(screen.getByText(/settings\.importMaaEndNewerProtocol:.*"version":2/)).not.toBeNull()
    expect(screen.queryByText(/settings\.importFormatMaaEndInvalid/)).toBeNull()
    expect((screen.getByText('settings.importConfirm') as HTMLButtonElement).disabled).toBe(true)
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
