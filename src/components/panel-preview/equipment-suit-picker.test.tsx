// @vitest-environment jsdom

import { cloneElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { EquipmentSuitPicker } from './equipment-suit-picker'

afterEach(cleanup)

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string) => key === 'noSetEquipment' ? '独立装备' : key,
}))

vi.mock('@/generated/data/wiki/equipment', () => ({
  wikiEquipment: [{
    id: 'equipment-test',
    category: 'equipment',
    name: { 'zh-CN': '测试装备', en: 'Test equipment', ja: 'テスト装備', 'zh-TW': '測試裝備' },
    rarity: 5,
    imageId: 'equipment-test',
    partTypeId: '0',
    minimumLevel: 80,
  }],
}))

vi.mock('@/generated/data/wiki/planner-previews', () => ({
  wikiEquipmentPlannerPreviews: {
    'equipment-test': {
      stats: [{ attributeId: 'AllSkillDamageIncrease', levelOne: '+10%', maxLevel: '+20%', levelOneLabel: '+0', maxLevelLabel: '+3' }],
      craftingRecipes: [],
    },
  },
}))

vi.mock('@/hooks/use-wiki-translations', () => ({
  useWikiTranslations: () => ({
    entityName: () => '测试装备',
    suitName: (id: string) => id,
    equipmentStatLabel: (id: string) => id === 'AllSkillDamageIncrease' ? '所有技能伤害加成' : id,
  }),
}))

vi.mock('@/components/shared/rarity-frame', () => ({
  RarityFrame: ({ title }: { title: string }) => <span>{title}</span>,
}))

vi.mock('@/lib/equip-substats', () => ({
  equipSubAttrKey: (id: string, slot: string) => {
    if (id === 'equipment-test') return slot === 'sub1' ? '41' : slot === 'sub2' ? '39' : 'AllSkillDamageIncrease'
    return ''
  },
}))

vi.mock('@/components/shared/planner-wiki-preview', () => ({
  PlannerWikiPreview: ({ rows }: { rows: Array<{ label: string }> }) => <div>{rows.map((row) => <span key={row.label}>{row.label}</span>)}</div>,
}))

vi.mock('@/hooks/use-mobile-long-press-tooltip', () => ({
  useMobileLongPressTooltip: () => ({
    open: true,
    setOpen: vi.fn(),
    triggerRef: { current: null },
    longPressTriggered: { current: false },
    handleOpenChange: vi.fn(),
    handlePointerDown: vi.fn(),
    handlePointerMove: vi.fn(),
    handlePointerEnd: vi.fn(),
    handleContextMenu: vi.fn(),
    swallowLongPressClick: () => false,
    isMobile: false,
  }),
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  // render 是触发器元素 (如 Button), children 是其内容: 组合后 accessible name 才完整。
  TooltipTrigger: ({ render, children }: { render: React.ReactElement; children: React.ReactNode }) => cloneElement(render, undefined, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TOOLTIP_OPEN_DELAY_MS: 0,
}))

it('labels the search box and filters the suit groups', () => {
  render(<EquipmentSuitPicker partTypeId="0" selectedId={null} onSelect={() => undefined} />)
  const search = screen.getByRole('textbox', { name: 'wiki.searchPlaceholder' })
  expect(search.getAttribute('placeholder')).toBe('wiki.searchPlaceholder')

  expect(screen.getByRole('button', { name: /独立装备/ })).toBeTruthy()
  fireEvent.change(search, { target: { value: '不存在的装备' } })
  expect(screen.queryByRole('button', { name: /独立装备/ })).toBeNull()
})

it('uses localized equipment stat labels in selection tooltips', () => {
  render(<EquipmentSuitPicker partTypeId="0" selectedId="equipment-test" onSelect={() => undefined} />)
  fireEvent.click(screen.getByRole('button', { name: /独立装备/ }))
  const selected = screen.getByRole('button', { name: '测试装备' })
  expect(selected.getAttribute('aria-pressed')).toBe('true')
  expect(selected.className).toContain('ring-amber-400/50')
  expect(selected.className).toContain('ring-offset-2')

  expect(screen.getByText('所有技能伤害加成')).toBeTruthy()
  expect(screen.queryByText('AllSkillDamageIncrease')).toBeNull()
})

it('filters equipment by refinement sub-attributes', () => {
  render(<EquipmentSuitPicker partTypeId="0" selectedId={null} onSelect={() => undefined} />)

  // 折叠状态下只有切换按钮; 展开后出现三组属性 chip。
  const toggle = screen.getByRole('button', { name: 'refinement.attributeFilters' })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')

  expect(screen.getByText('refinement.subAttr1')).toBeTruthy()
  expect(screen.getByText('refinement.subAttr2')).toBeTruthy()
  expect(screen.getByText('refinement.specialEffect')).toBeTruthy()

  // chip 标签走 equipStats 命名空间 (mock 返回 key 本身)。
  const chip = screen.getByRole('button', { name: 'equipStats.41' })
  fireEvent.click(chip)
  // 激活计数 + 清除按钮出现, 装备列表保留。
  expect(screen.getByText('1', { selector: '.font-geist-mono' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'refinement.clearFilters' })).toBeTruthy()
  expect(screen.getByRole('button', { name: /独立装备/ })).toBeTruthy()

  // 选中不匹配的属性 (sub2 = 39, 而装备 sub2 正是 39, 装备仍保留)。
  fireEvent.click(screen.getByRole('button', { name: 'equipStats.39' }))
  expect(screen.getByRole('button', { name: /独立装备/ })).toBeTruthy()

  // 清除筛选: 计数消失。
  fireEvent.click(screen.getByRole('button', { name: 'refinement.clearFilters' }))
  expect(screen.queryByText('1', { selector: '.font-geist-mono' })).toBeNull()
})
