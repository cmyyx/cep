// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PanelStatsSummary } from './panel-stats-summary'

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/image', () => ({
  default: () => <span aria-hidden="true" />,
}))

vi.mock('@/stores/usePanelPreviewStore', () => ({
  usePanelPreviewStore: (selector: (state: { config: object }) => unknown) => selector({ config: {} }),
}))

vi.mock('@/lib/planner/progression', () => ({
  calculatePanelStats: () => ({
    strength: 1234567.89,
    agility: 2,
    intellect: 3,
    will: 4,
    hp: 5,
    attack: 6,
    defense: 7,
    modifiers: [],
    attributeContributions: [],
    setEffects: [],
  }),
}))

vi.mock('@/hooks/use-wiki-translations', () => ({
  useWikiTranslations: () => ({
    text: (...segments: Array<string | number>) => String(segments.at(-1)),
    enumLabel: (_group: string, id: string) => `attr-${id}`,
    equipmentStatLabel: (id: string) => `stat-${id}`,
  }),
}))

vi.mock('@/components/wiki/wiki-rich-text', () => ({
  WikiRichText: () => null,
}))

it('keeps long primary stat values visible on narrow layouts', () => {
  render(<PanelStatsSummary />)

  const value = screen.getByText('1,234,567.89')
  expect(value.className).toContain('text-[9px]')
  expect(value.className).toContain('sm:text-base')
  expect(value.className).not.toContain('truncate')
})
