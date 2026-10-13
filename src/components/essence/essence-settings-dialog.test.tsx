// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EssenceSettingsDialog } from './essence-settings-dialog'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

vi.mock('@/hooks/use-wiki-translations', () => ({
  useWikiTranslations: () => ({
    text: (...segments: Array<string | number>) => String(segments.at(-1) ?? ''),
    entityName: (entity: { id: string }) => entity.id,
    enumLabel: (_group: string, id: string) => id,
  }),
}))

afterEach(() => {
  cleanup()
  useEssenceSettingsStore.getState().resetAllSettings()
})

/** Opens the dialog and returns its popup element. */
function openDialog(): HTMLElement {
  render(<EssenceSettingsDialog />)
  fireEvent.click(screen.getByRole('button', { name: 'essence.settings' }))
  const content = document.querySelector('[data-slot="dialog-content"]')
  if (!content) throw new Error('dialog content not found')
  return content as HTMLElement
}

describe('EssenceSettingsDialog mobile sizing', () => {
  it('bounds the popup to the viewport height', () => {
    const content = openDialog()
    // Without a max-height the popup grows to ~693px and its header/Close
    // button fall outside a 600px phone viewport (unreachable).
    expect(content.className).toContain('max-h-[calc(100dvh-2rem)]')
    expect(content.className).toContain('overflow-y-auto')
  })

  it('keeps the default dialog layer so in-dialog dropdowns stay on top', () => {
    const content = openDialog()
    // 通知堆自己浮在 z-[60]，对话框保持 shadcn 默认的 z-50；不要加 z 覆盖值——
    // 之前加 z-[70] 导致对话框内的 Select 弹层（z-50）被对话框自己盖住，
    // 表现就是“点下拉框没反应”。
    expect(/z-\[/.test(content.className)).toBe(false)
  })

  it('toggles the per-account selection switch (default on)', () => {
    openDialog()
    expect(useEssenceSettingsStore.getState().separateSelectionPerAccount).toBe(true)

    const row = screen.getByText('essenceSettings.separateSelectionPerAccount')
    const sw = row.parentElement?.parentElement?.querySelector('[role="switch"]')
    if (!sw) throw new Error('switch not found')
    fireEvent.click(sw)

    expect(useEssenceSettingsStore.getState().separateSelectionPerAccount).toBe(false)
  })
})

describe('EssenceSettingsDialog body', () => {
  it('scrolls the whole popup instead of an inner 60vh box', () => {
    const content = openDialog()
    expect(content.className).toContain('overflow-y-auto')
    expect(document.querySelector('.max-h-\\[60vh\\]')).toBeNull()

    // Every settings block must live in that one scroll region, otherwise the
    // lower half stays clipped on phones.
    expect(content.textContent).toContain('essenceSettings.settingItem')
    expect(content.textContent).toContain('essenceSettings.acquisitionCategories')
    expect(content.textContent).toContain('essenceSettings.regionPriority')
  })
})
