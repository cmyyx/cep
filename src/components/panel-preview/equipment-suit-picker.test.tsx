// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { EquipmentSuitPicker } from './equipment-suit-picker'

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

vi.mock('@/components/shared/planner-wiki-preview', () => ({
  PlannerWikiPreview: ({ rows }: { rows: Array<{ label: string }> }) => <div>{rows.map((row) => <span key={row.label}>{row.label}</span>)}</div>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ render: trigger }: { render: React.ReactNode }) => <>{trigger}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

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
