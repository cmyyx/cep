// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountSwitcher } from './account-switcher'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

afterEach(() => {
  cleanup()
  useEssenceSettingsStore.getState().resetAllSettings()
})

describe('AccountSwitcher', () => {
  it('shows the active account name and switches accounts', () => {
    const store = useEssenceSettingsStore.getState()
    store.renameAccount(store.accounts[0].id, '主号')
    const secondId = store.addAccount('小号')

    render(<AccountSwitcher />)
    // The new account becomes active immediately; switch back to 主号.
    expect(screen.getByText('小号')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'essence.accountSwitcher' }))
    fireEvent.click(screen.getByText('主号'))
    expect(useEssenceSettingsStore.getState().activeAccountId).toBe(store.accounts[0].id)
    expect(useEssenceSettingsStore.getState().accounts.some((a) => a.id === secondId)).toBe(true)
  })

  it('creates a new account through the dialog and activates it', () => {
    render(<AccountSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: 'essence.accountSwitcher' }))
    fireEvent.click(screen.getByText('essence.accountNew'))

    const input = screen.getByLabelText('essence.accountNameLabel') as HTMLInputElement
    fireEvent.change(input, { target: { value: '三号' } })
    fireEvent.click(screen.getByText('essence.save'))

    const state = useEssenceSettingsStore.getState()
    expect(state.accounts.length).toBe(2)
    expect(state.accounts[1].name).toBe('三号')
    expect(state.activeAccountId).toBe(state.accounts[1].id)
  })

  it('deletes the active account after confirmation, guarded by a 3s cooldown', () => {
    vi.useFakeTimers()
    try {
      const store = useEssenceSettingsStore.getState()
      store.addAccount('临时')
      render(<AccountSwitcher />)
      fireEvent.click(screen.getByRole('button', { name: 'essence.accountSwitcher' }))
      fireEvent.click(screen.getByText('essence.accountDelete'))

      // The confirm button is locked with a visible countdown.
      const confirmButton = screen.getAllByRole('button', { name: 'essence.accountDelete (3s)' })[0]
      expect((confirmButton as HTMLButtonElement).disabled).toBe(true)

      // After the 3s cooldown the button unlocks and deleting works.
      act(() => { vi.advanceTimersByTime(3000) })
      const unlocked = screen.getByRole('button', { name: 'essence.accountDelete' })
      expect((unlocked as HTMLButtonElement).disabled).toBe(false)
      fireEvent.click(unlocked)

      const state = useEssenceSettingsStore.getState()
      expect(state.accounts.length).toBe(1)
      expect(state.accounts[0].name).toBe('账号 1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('explains the account cap instead of silently disabling creation', () => {
    const store = useEssenceSettingsStore.getState()
    // Fill to the 10-account cap (1 default + 9 more).
    for (let i = 0; i < 9; i += 1) store.addAccount(`A${i}`)
    render(<AccountSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: 'essence.accountSwitcher' }))
    fireEvent.click(screen.getByText('essence.accountNew'))

    // The limit hint dialog opens; no account is added.
    expect(screen.getByText('essence.accountMaxReached')).not.toBeNull()
    expect(useEssenceSettingsStore.getState().accounts.length).toBe(10)
  })
})
