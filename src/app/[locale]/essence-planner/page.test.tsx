// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EssencePlannerPage from './page'
import { useMatrixStore } from '@/stores/useMatrixStore'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/zh-CN/essence-planner',
}))

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))
vi.mock('@/hooks/use-site-url', () => ({ useSiteUrl: () => 'https://example.com' }))
vi.mock('@/hooks/use-wiki-translations', () => ({
  useWikiTranslations: () => ({
    text: (...segments: Array<string | number>) => String(segments.at(-1) ?? ''),
    entityName: (entity: { id: string }) => entity.id,
    enumLabel: (_group: string, id: string) => id,
  }),
}))

// The grid has its own DOM test; the page test only cares about the chrome.
vi.mock('@/components/essence/weapon-grid', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/essence/weapon-grid')>()
  return { ...actual, WeaponGrid: () => null }
})

// SidebarTrigger needs SidebarProvider; the trigger itself is not under test.
vi.mock('@/components/ui/sidebar', () => ({ SidebarTrigger: () => null }))

function stubMatchMedia(matches = true) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useMatrixStore.setState({ selectedWeaponIds: [], visibleWeaponIds: [] })
})

describe('EssencePlanner top bar', () => {
  it('labels the custom-weapon and settings buttons for desktop only', () => {
    stubMatchMedia()
    render(<EssencePlannerPage />)

    const plus = screen.getByRole('button', { name: 'essence.customWeapons' })
    expect(plus.textContent).toContain('essence.customWeapons')
    const gear = screen.getByRole('button', { name: 'essence.settings' })
    expect(gear.textContent).toContain('essence.settingsShort')

    // Text is md-only: the 390px bar has ~32px slack, labels would overflow it.
    for (const label of [plus, gear]) {
      const text = label.querySelector('span.hidden')
      expect(text?.className).toContain('md:inline')
    }
  })
})

describe('Selected list entry points', () => {
  it('keeps the mobile bottom-bar entry enabled with nothing selected', () => {
    stubMatchMedia()
    render(<EssencePlannerPage />)

    const entries = screen.getAllByRole('button', { name: 'essence.selectedList' })
    const enabled = entries.filter((button) => !(button as HTMLButtonElement).disabled)
    expect(enabled.length).toBeGreaterThan(0)
  })

  it('offers select-all in the panel even with an empty selection', () => {
    stubMatchMedia()
    useMatrixStore.setState({ visibleWeaponIds: ['wpn_a', 'wpn_b'] })
    render(<EssencePlannerPage />)

    fireEvent.click(screen.getByRole('button', { name: 'essence.selectedList' }))

    const selectAll = screen.getByRole('button', { name: 'essence.selectAll' })
    fireEvent.click(selectAll)
    expect(useMatrixStore.getState().selectedWeaponIds).toEqual(['wpn_a', 'wpn_b'])

    const clear = screen.getByRole('button', { name: 'essence.clearAll' }) as HTMLButtonElement
    expect(clear.disabled).toBe(false)
    fireEvent.click(clear)
    expect(useMatrixStore.getState().selectedWeaponIds).toEqual([])
  })

  it('disables clear while nothing is selected', () => {
    stubMatchMedia()
    render(<EssencePlannerPage />)

    fireEvent.click(screen.getByRole('button', { name: 'essence.selectedList' }))
    const clear = screen.getByRole('button', { name: 'essence.clearAll' }) as HTMLButtonElement
    expect(clear.disabled).toBe(true)
  })
})
