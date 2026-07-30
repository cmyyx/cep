// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { plannerGameData } from '@/generated/data/planner'
import { loadPlannerData } from '@/lib/planner/planner-data-loader'
import { createDefaultPanelPreviewConfig, usePanelPreviewStore } from '@/stores/usePanelPreviewStore'
import { CharacterPanelConfig } from './character-panel-config'

// The component reads planner data synchronously from the loader cache; prime
// it up front the same way the gated pages do.
await loadPlannerData()

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/use-wiki-translations', () => ({
  useWikiTranslations: () => ({
    entityName: (entity: { id: string }) => entity.id,
    text: (...segments: Array<string | number>) => String(segments.at(-1)),
    equipmentStatLabel: (id: string) => id,
    enumLabel: (_group: string, id: string) => id,
  }),
}))

vi.mock('@/components/shared/rarity-frame', () => ({
  RarityFrame: ({ title }: { title: string }) => <span>{title}</span>,
}))

vi.mock('@/components/shared/wiki-entity-picker', () => ({
  WikiEntityPicker: () => null,
}))

beforeEach(() => {
  usePanelPreviewStore.setState({ config: createDefaultPanelPreviewConfig('chr_0018_dapan') })
})

afterEach(() => {
  cleanup()
  usePanelPreviewStore.setState({ config: null })
})

it('renders the selected operator potential level configuration', () => {
  render(<CharacterPanelConfig />)

  const input = screen.getByRole('spinbutton', { name: 'potentialLevel' })
  expect(input.getAttribute('min')).toBe('0')
  expect(input.getAttribute('max')).toBe(String(plannerGameData.characters.chr_0018_dapan.potentials.at(-1)?.level))
  expect(input.getAttribute('value')).toBe('5')
})
