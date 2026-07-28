// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PanelStatsSummary, panelStatValueClass } from './panel-stats-summary'

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

// 面板数值不做四舍五入 (要与游戏内逐位对照), 所以小数位可能很多。
vi.mock('@/lib/planner/progression', () => ({
  calculatePanelStats: () => ({
    strength: 1234567.89,
    agility: 2,
    intellect: 3,
    will: 4,
    hp: 105.6340205,
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

afterEach(cleanup)

it('keeps long primary stat values visible on narrow layouts', () => {
  render(<PanelStatsSummary />)

  const value = screen.getByText('1,234,567.89')
  expect(value.className).toContain('text-[9px]')
  // 长数值在桌面也必须降档: 固定 sm:text-base 会让它溢出瓷砖
  expect(value.className).toContain('sm:text-xs')
  expect(value.className).not.toContain('sm:text-base')
  expect(value.className).not.toContain('truncate')
})

it('renders combat stats with full precision through the same sizing tiers', () => {
  render(<PanelStatsSummary />)

  // 未被四舍五入成 105.63; 11 字符落在 >=10 档
  const value = screen.getByText('105.6340205')
  expect(value.className).toContain('break-all')
  expect(value.className).toContain('text-[9px]')
})

it('scales the type down as the value gets longer, and never clips it', () => {
  const tiers = [
    panelStatValueClass('123'), // 3
    panelStatValueClass('12345678'), // 8
    panelStatValueClass('1234567890'), // 10
    panelStatValueClass('1,234,567.8901'), // 14
  ]

  expect(tiers[0]).toContain('text-xs')
  expect(tiers[0]).toContain('sm:text-base')
  expect(tiers[1]).toContain('text-[10px]')
  expect(tiers[2]).toContain('text-[9px]')
  expect(tiers[3]).toContain('text-[8px]')
  // 纯数字没有断行点, 必须 break-all 才不会溢出
  for (const tier of tiers) {
    expect(tier).toContain('break-all')
    expect(tier).not.toContain('truncate')
  }
})
