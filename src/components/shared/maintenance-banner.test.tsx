// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useSystemStatusStore } from '@/stores/useSystemStatusStore'
import { MaintenanceBanner } from './maintenance-banner'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/use-maintenance-probe', () => ({
  useMaintenanceProbe: vi.fn(),
}))

describe('MaintenanceBanner', () => {
  beforeEach(() => {
    useSystemStatusStore.setState({ maintenance: false })
  })

  afterEach(cleanup)

  it('正常状态不渲染', () => {
    const { container } = render(<MaintenanceBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('维护状态渲染提示文案', () => {
    useSystemStatusStore.setState({ maintenance: true })
    render(<MaintenanceBanner />)
    expect(screen.getByText('account.maintenanceMode')).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('恢复后自动消失', () => {
    useSystemStatusStore.setState({ maintenance: true })
    const { container, rerender } = render(<MaintenanceBanner />)
    expect(container.firstChild).not.toBeNull()

    useSystemStatusStore.getState().reportHealthy()
    rerender(<MaintenanceBanner />)
    expect(container.firstChild).toBeNull()
  })
})
