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

// 面板主数值走游戏显示口径 (非百分比属性向下取整), 精确值另起一行小字。
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

it('shows the in-game display value (floored) as the primary number', () => {
  render(<PanelStatsSummary />)

  // 105.6340205 在游戏面板上显示 105
  const primary = screen.getByText('105')
  expect(primary.className).toContain('break-all')
  expect(primary.className).not.toContain('truncate')
})

it('keeps the exact value on a second line for digit-by-digit comparison', () => {
  render(<PanelStatsSummary />)

  // 精确值小字 (固定 9px 档, 与本行末注释一致)
  expect(screen.getByText('105.6340205').className).toContain('text-[9px]')
  expect(screen.getByText('105.6340205').className).toContain('text-muted-foreground/70')
  // 大数值带千位分隔, 且精确值同样保留
  expect(screen.getByText('1,234,567')).toBeTruthy()
  expect(screen.getByText('1,234,567.89')).toBeTruthy()
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
