// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, expect, it } from 'vitest'
import messages from '@/messages/zh-CN.json'
import enMessages from '@/messages/en.json'
import jaMessages from '@/messages/ja.json'
import twMessages from '@/messages/zh-TW.json'
import { loadClientMessages, loadPlannerCatalogs, loadRouteShellMessages } from '@/i18n/load-messages'
import type { WikiLocale } from '@/types/wiki'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { MaaEndEssenceImportDialog } from './maaend-essence-import-dialog'

beforeEach(() => {
  localStorage.clear()
  useEssenceSettingsStore.getState().resetAllSettings()
})
afterEach(cleanup)

function clientMessages(locale: WikiLocale) {
  return {
    ...loadClientMessages(locale),
    ...loadRouteShellMessages(locale, 'essence-planner'),
    ...loadPlannerCatalogs(locale, 'essence'),
  }
}

function openImporter() {
  render(
    <NextIntlClientProvider locale="zh-CN" messages={clientMessages('zh-CN')}>
      <MaaEndEssenceImportDialog />
    </NextIntlClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: messages.maaendImport.title }))
}

function selectFile(read: () => Promise<string>) {
  const file = new File([''], 'EssenceInventory.json', { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: read })
  fireEvent.change(screen.getByLabelText(messages.maaendImport.fileLabel), { target: { files: [file] } })
}

const inventoryText = JSON.stringify([{
  weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1, 1], count: 1 }],
}])

it('previews compatible marks without writing until the user confirms', async () => {
  useEssenceSettingsStore.getState().setEssenceStatus('wpn_sword_0016', true)
  const before = useEssenceSettingsStore.getState()
  openImporter()
  selectFile(async () => inventoryText)

  expect(await screen.findByText('待新增勾选（1）')).toBeTruthy()
  expect(screen.getByText('本次扫描未发现，已保留（1）')).toBeTruthy()
  expect(screen.getByText('热熔切割器')).toBeTruthy()
  expect(screen.getByText('不知归')).toBeTruthy()
  expect(useEssenceSettingsStore.getState()).toBe(before)
  fireEvent.click(screen.getByRole('button', { name: '确定导入' }))
  expect(await screen.findByText('新增勾选（1）')).toBeTruthy()
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({ wpn_sword_0016: true, wpn_sword_0012: true })
})

it('shows skipped unknown IDs alongside imported marks', async () => {
  openImporter()
  selectFile(async () => JSON.stringify([{
    weapon_ids: ['wpn_sword_0012', 'wpn_future_9999'], essences: [{ levels: [6, 6, 3], count: 1 }],
  }]))
  expect(await screen.findByText('未知武器，已跳过（1）')).toBeTruthy()
  expect(screen.getByText('wpn_future_9999')).toBeTruthy()
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({})
  fireEvent.click(screen.getByRole('button', { name: messages.maaendImport.confirm }))
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({ wpn_sword_0012: true })
})

it.each([
  ['{', messages.maaendImport.invalidJson],
  ['{}', messages.maaendImport.invalidFormat],
  [JSON.stringify([{ weapon_ids: ['wpn_future_9999'], essences: [{ levels: [1, 1, 1], count: 1 }] }]), messages.maaendImport.unknownOnly],
])('shows a translated file error and preserves marks for %s', async (text, errorMessage) => {
  useEssenceSettingsStore.getState().setEssenceStatus('wpn_sword_0016', true)
  const before = useEssenceSettingsStore.getState()
  openImporter()
  selectFile(async () => text)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByText(errorMessage)).toBeTruthy()
  expect(useEssenceSettingsStore.getState()).toBe(before)
})

it('keeps previous marks on a read failure and allows retrying', async () => {
  openImporter()
  const before = useEssenceSettingsStore.getState()
  selectFile(async () => { throw new Error('Read failure') })
  expect(await screen.findByText(messages.maaendImport.readError)).toBeTruthy()
  expect(useEssenceSettingsStore.getState()).toBe(before)
  selectFile(async () => inventoryText)
  expect(await screen.findByText('待新增勾选（1）')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(useEssenceSettingsStore.getState()).toBe(before)
})

it('reports zero additions on a repeated file and keeps marks on an empty scan', async () => {
  openImporter()
  selectFile(async () => inventoryText)
  expect(await screen.findByText('待新增勾选（1）')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: messages.maaendImport.confirm }))
  expect(await screen.findByText('新增勾选（1）')).toBeTruthy()
  selectFile(async () => inventoryText)
  expect(await screen.findByText('待新增勾选（0）')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: messages.maaendImport.confirm }))
  expect(await screen.findByText(messages.maaendImport.noNewMarks)).toBeTruthy()
  expect(screen.getByText('与本次扫描一致（1）')).toBeTruthy()
  selectFile(async () => '[]')
  expect(await screen.findByText(messages.maaendImport.emptyScan)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: messages.maaendImport.confirm }))
  expect(screen.getByText('本次扫描未发现，已保留（1）')).toBeTruthy()
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({ wpn_sword_0012: true })
})

it('preserves and names custom weapon marks outside the scan scope', async () => {
  const store = useEssenceSettingsStore.getState()
  store.addCustomWeapon({ id: 'custom-ui', name: 'My custom weapon', rarity: 6, type: '单手剑', primaryStat: null, elementalDamage: null, specialAbility: null, chars: [] })
  store.setEssenceStatus('custom-ui', true)
  openImporter()
  selectFile(async () => '[]')
  expect(await screen.findByText('自定义武器已保留（1）')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '自定义武器已保留（1）' }))
  expect(await screen.findByText('My custom weapon')).toBeTruthy()
  expect(screen.getByText(messages.maaendImport.customHint)).toBeTruthy()
  expect(useEssenceSettingsStore.getState().essenceStatus['custom-ui']).toBe(true)
})

it('rejects an import if the active account changes while reading', async () => {
  openImporter()
  let complete!: (text: string) => void
  selectFile(() => new Promise((resolve) => { complete = resolve }))
  const firstId = useEssenceSettingsStore.getState().activeAccountId
  act(() => { useEssenceSettingsStore.getState().addAccount('Other') })
  complete(inventoryText)
  expect(await screen.findByText(messages.maaendImport.accountChanged)).toBeTruthy()
  const state = useEssenceSettingsStore.getState()
  expect(state.essenceStatus).toEqual({})
  expect(state.accounts.find((account) => account.id === firstId)?.essenceStatus).toEqual({})
})

it('cancels a pending read when the dialog is closed', async () => {
  openImporter()
  let complete!: (text: string) => void
  selectFile(() => new Promise((resolve) => { complete = resolve }))
  fireEvent.click(screen.getByRole('button', { name: messages.common.close }))
  await act(async () => { complete(inventoryText) })
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({})
  fireEvent.click(screen.getByRole('button', { name: messages.maaendImport.title }))
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
})

it('lets the user exclude scanned additions before importing while preserving all old marks', async () => {
  const store = useEssenceSettingsStore.getState()
  store.setEssenceStatus('wpn_sword_0001', true)
  openImporter()
  selectFile(async () => JSON.stringify([{
    weapon_ids: ['wpn_sword_0012', 'wpn_sword_0016'], essences: [{ levels: [1, 1, 1], count: 1 }],
  }]))
  expect(await screen.findByText('待新增勾选（2）')).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: '热熔切割器' }))
  expect(screen.getByText('本次将新增 1 把武器的基质勾选')).toBeTruthy()
  expect(screen.getByText('待新增勾选（1）')).toBeTruthy()
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({ wpn_sword_0001: true })
  fireEvent.click(screen.getByRole('button', { name: messages.maaendImport.confirm }))
  expect(await screen.findByText('新增勾选（1）')).toBeTruthy()
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({ wpn_sword_0001: true, wpn_sword_0016: true })
  expect(screen.queryByRole('button', { name: messages.maaendImport.confirm })).toBeNull()
})

it('does not let import selection clear a mark the account already owns', async () => {
  useEssenceSettingsStore.getState().setEssenceStatus('wpn_sword_0012', true)
  openImporter()
  selectFile(async () => inventoryText)
  expect(await screen.findByText('与本次扫描一致（1）')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '与本次扫描一致（1）' }))
  expect(screen.getByRole('checkbox', { name: '热熔切割器' }).getAttribute('aria-disabled')).toBe('true')
  fireEvent.click(screen.getByRole('checkbox', { name: '热熔切割器' }))
  fireEvent.click(screen.getByRole('button', { name: messages.maaendImport.confirm }))
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({ wpn_sword_0012: true })
})

it('discards an unconfirmed preview when closed', async () => {
  openImporter()
  selectFile(async () => inventoryText)
  expect(await screen.findByText('待新增勾选（1）')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: messages.common.close }))
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({})
  fireEvent.click(screen.getByRole('button', { name: messages.maaendImport.title }))
  expect(screen.queryByRole('button', { name: messages.maaendImport.confirm })).toBeNull()
})

it('rejects confirmation if the account changed after the preview', async () => {
  openImporter()
  selectFile(async () => inventoryText)
  expect(await screen.findByText('待新增勾选（1）')).toBeTruthy()
  act(() => { useEssenceSettingsStore.getState().addAccount('Other') })
  expect(screen.getByText(messages.maaendImport.accountChanged)).toBeTruthy()
  expect(screen.getByRole('button', { name: messages.maaendImport.confirm }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: messages.maaendImport.confirm }))
  expect(useEssenceSettingsStore.getState().accounts.every((account) => Object.keys(account.essenceStatus).length === 0)).toBe(true)
})

it('resets import selections when a different file is chosen', async () => {
  openImporter()
  selectFile(async () => inventoryText)
  expect(await screen.findByText('待新增勾选（1）')).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: '热熔切割器' }))
  selectFile(async () => JSON.stringify([{
    weapon_ids: ['wpn_sword_0016'], essences: [{ levels: [1, 1, 1], count: 1 }],
  }]))
  const checkbox = await screen.findByRole('checkbox', { name: '不知归' })
  expect(checkbox.getAttribute('aria-checked')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: messages.maaendImport.confirm }))
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({ wpn_sword_0016: true })
})

it('imports nothing when all new marks are unchecked', async () => {
  openImporter()
  selectFile(async () => inventoryText)
  expect(await screen.findByText('待新增勾选（1）')).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: '热熔切割器' }))
  fireEvent.click(screen.getByRole('button', { name: messages.maaendImport.confirm }))
  expect(await screen.findByText(messages.maaendImport.noNewMarks)).toBeTruthy()
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({})
})

it.each([
  ['zh-CN', messages], ['en', enMessages], ['ja', jaMessages], ['zh-TW', twMessages],
] as const)('renders the preview and confirmation in %s without missing translations', async (locale, catalog) => {
  const intlErrors: unknown[] = []
  render(
    <NextIntlClientProvider locale={locale} messages={clientMessages(locale)} onError={(error) => intlErrors.push(error)}>
      <MaaEndEssenceImportDialog />
    </NextIntlClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: catalog.maaendImport.title }))
  const file = new File([''], 'EssenceInventory.json')
  Object.defineProperty(file, 'text', { value: async () => inventoryText })
  fireEvent.change(screen.getByLabelText(catalog.maaendImport.fileLabel), { target: { files: [file] } })
  expect(await screen.findByRole('button', { name: catalog.maaendImport.confirm })).toBeTruthy()
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({})
  fireEvent.click(screen.getByRole('button', { name: catalog.maaendImport.confirm }))
  expect(useEssenceSettingsStore.getState().essenceStatus).toEqual({ wpn_sword_0012: true })
  expect(intlErrors).toEqual([])
})
