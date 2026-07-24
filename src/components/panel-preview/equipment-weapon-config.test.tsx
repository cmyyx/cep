// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { plannerGameData } from '@/generated/data/planner'
import { createDefaultPanelPreviewConfig, createPanelEquipmentSelection, usePanelPreviewStore } from '@/stores/usePanelPreviewStore'
import { EquipmentWeaponConfig } from './equipment-weapon-config'

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => ({
    armor: 'Armor',
    gloves: 'Gloves',
    accessoryOne: 'Accessory one',
    accessoryTwo: 'Accessory two',
    chooseWeapon: 'Choose weapon',
    chooseEquipment: 'Choose equipment',
    statLevel: 'Stat level',
  })[key] ?? key,
}))

vi.mock('@/hooks/use-wiki-translations', () => ({
  useWikiTranslations: () => ({
    entityName: (entity: { id: string }) => entity.id,
    enumLabel: (_group: string, id: string) => id === '3' ? 'Defense' : `Attribute ${id}`,
    equipmentStatLabel: (id: string) => id === '3' ? 'Defense' : `Attribute ${id}`,
    text: (...segments: Array<string | number>) => String(segments.at(-1)),
  }),
}))

vi.mock('@/components/shared/rarity-frame', () => ({
  RarityFrame: ({ title }: { title: string }) => <span>{title}</span>,
}))

vi.mock('@/components/shared/wiki-entity-picker', () => ({
  WikiEntityPicker: () => null,
}))

vi.mock('@/components/shared/planner-wiki-preview', () => ({
  PlannerWikiPreview: () => null,
}))

vi.mock('@/components/wiki/wiki-rich-text', () => ({
  WikiRichText: () => null,
}))

vi.mock('@/components/panel-preview/equipment-suit-picker', () => ({
  EquipmentSuitPicker: () => null,
}))

const EQUIPMENT_ID = 'item_equip_t0_parts_tundra01_body_01'

beforeEach(() => {
  const characterId = Object.keys(plannerGameData.characters)[0]
  usePanelPreviewStore.setState({
    config: {
      ...createDefaultPanelPreviewConfig(characterId),
      armor: createPanelEquipmentSelection(EQUIPMENT_ID),
    },
  })
})

afterEach(() => {
  cleanup()
  usePanelPreviewStore.setState({ config: null })
})

it('renders fixed equipment defense as a read-only value', () => {
  render(<EquipmentWeaponConfig />)

  const defenseRow = screen.getByText('Defense').parentElement
  expect(defenseRow).not.toBeNull()
  expect(within(defenseRow as HTMLElement).getByText('+8')).toBeTruthy()
  expect(within(defenseRow as HTMLElement).queryByRole('spinbutton')).toBeNull()
  expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0)
})
