// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SelectedWeaponsStrip } from './selected-weapons-strip'
import { WeaponGrid } from './weapon-grid'
import { useMatrixStore } from '@/stores/useMatrixStore'

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
  vi.unstubAllGlobals()
  useMatrixStore.setState({ selectedWeaponIds: [], visibleWeaponIds: [] })
})

// jsdom has no matchMedia; the weapon cards read it through useIsMobile/tooltip hooks.
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

describe('WeaponGrid search row', () => {
  it('keeps only the search input', () => {
    stubMatchMedia()
    render(<WeaponGrid />)
    expect(screen.getByPlaceholderText('essence.searchWeapon')).not.toBeNull()
    // Select-all / clear moved into the 已选清单 panel — the cramped row next to
    // the search box no longer duplicates them.
    expect(screen.queryByRole('button', { name: 'essence.selectAll' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'essence.clearAll' })).toBeNull()
  })
})

describe('SelectedWeaponsStrip entry point', () => {
  it('stays reachable with an empty selection', () => {
    const onViewAll = vi.fn()
    render(
      <SelectedWeaponsStrip
        selectedIds={[]}
        weaponsMap={new Map()}
        onToggleWeapon={() => {}}
        onViewAll={onViewAll}
      />,
    )

    // Without this the only remaining way to reach 全选 disappears as soon as
    // nothing is selected, on both desktop and mobile.
    const entry = screen.getByRole('button', { name: /essence.selectedList/ })
    fireEvent.click(entry)
    expect(onViewAll).toHaveBeenCalledTimes(1)
  })

  it('hides the entry when no panel is wired up', () => {
    render(
      <SelectedWeaponsStrip
        selectedIds={[]}
        weaponsMap={new Map()}
        onToggleWeapon={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /essence.selectedList/ })).toBeNull()
  })
})
