// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/planner/planner-data-loader', () => ({
  getCachedPlannerGameData: () => undefined,
  loadPlannerData: () => Promise.resolve({}),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/zh-CN/essence-planner',
}))

vi.mock('@/hooks/use-version', () => ({
  useVersion: () => ({ isUpdateAvailable: false, refreshPage: vi.fn() }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'zh-CN',
}))

const { SyncNotifier } = await import('./sync-notifier')
const { DataImportDialog } = await import('./data-import-dialog')
const { prepareImport } = await import('@/lib/data-import')
const { useDataImportStore } = await import('@/stores/useDataImportStore')
const { useEssenceSettingsStore } = await import('@/stores/useEssenceSettingsStore')
const { notifySync } = await import('@/hooks/useAutoSync')

/** Same shape as a real MaaEND EssenceInventory.json export. */
const maaEndInventory = [
  { weapon_ids: ['wpn_claym_0004', 'wpn_lance_0011'], essences: [{ levels: [1, 1, 1], count: 1 }] },
]

function seedAccount() {
  useEssenceSettingsStore.setState({
    accounts: [
      {
        id: 'acc_a',
        name: '主号',
        weaponOwnership: {},
        essenceStatus: {},
        weaponNotes: {},
        selectedWeaponIds: [],
      },
    ],
    activeAccountId: 'acc_a',
    weaponOwnership: {},
    essenceStatus: {},
    weaponNotes: {},
    customWeapons: [],
    hiddenAcquisitionCategoriesList: [],
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

/** Mirrors the real mount order in the locale layout: SyncManager, then DataImportDialog. */
function renderApp() {
  return render(
    <>
      <SyncNotifier />
      <DataImportDialog />
    </>,
  )
}

async function dropAndConfirm() {
  const prepared = await prepareImport(maaEndInventory)
  useDataImportStore.getState().requestImport('EssenceInventory.json', prepared)
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: 'settings.importConfirm' }))
  await act(async () => {})
}

describe('import result toast (SyncNotifier + DataImportDialog)', () => {
  afterEach(() => {
    cleanup()
    useDataImportStore.setState({ request: null, errorKey: null, success: false })
  })

  it('shows the success message after a MaaEND import', async () => {
    seedAccount()
    renderApp()

    await dropAndConfirm()

    expect(screen.getByText('settings.importSuccess')).toBeTruthy()
  })

  it('still shows it when a sync conflict toast is on screen', async () => {
    seedAccount()
    renderApp()

    await act(async () => {
      notifySync({ type: 'push_conflict' })
    })
    expect(screen.getByText('account.syncConflictToast')).toBeTruthy()

    await dropAndConfirm()

    expect(screen.getByText('settings.importSuccess')).toBeTruthy()
  })

  it('stacks the import result on top of the conflict notice instead of queueing it', async () => {
    seedAccount()
    renderApp()

    await act(async () => {
      notifySync({ type: 'push_conflict' })
    })
    await dropAndConfirm()

    // 两条通知同时在堆里: 持久通知不阻塞导入结果, 导入结果也不顶掉持久通知。
    expect(screen.getByText('account.syncConflictToast')).toBeTruthy()
    expect(screen.getByText('settings.importSuccess')).toBeTruthy()
  })
})
