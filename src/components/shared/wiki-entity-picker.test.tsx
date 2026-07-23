// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { WikiEntityPicker } from './wiki-entity-picker'
import type { WikiCharacterSummary } from '@/types/wiki'

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => {
    const translate = Object.assign((key: string) => key, {
      has: () => false,
      raw: (key: string) => key,
    })
    return translate
  },
}))

vi.mock('@/lib/game-i18n-catalogs', () => {
  const characters: Record<string, string> = {
    high: '高星',
    low: '低星',
    one: '佩丽卡',
    two: '陈千语',
  }
  const wikiData: Record<string, string> = {
    'enum|elements|Physical': '物理',
    'enum|elements|Natural': '自然',
  }

  return {
    hasGameI18n: (_locale: string, namespace: string, key: string) => {
      if (namespace === 'characters') return key in characters
      if (namespace === 'wikiData') return key in wikiData
      return false
    },
    lookupGameI18n: (_locale: string, namespace: string, key: string) => {
      if (namespace === 'characters') return characters[key]
      if (namespace === 'wikiData') return wikiData[key]
      return undefined
    },
  }
})

afterEach(cleanup)

const localized = (value: string) => ({ 'zh-CN': value, en: value, ja: value, 'zh-TW': value })
const character = (id: string, name: string, rarity: number): WikiCharacterSummary => ({
  id,
  category: 'characters',
  name: localized(name),
  rarity,
  imageId: id,
  elementId: 'Physical',
  professionId: '0',
  factionId: 'test',
  weaponTypeId: '1',
  mainAttributeId: '39',
  subAttributeId: '40',
})

it('uses Wiki rarity sorting and graphical entity cards', () => {
  render(<WikiEntityPicker title="干员" entities={[character('low', '低星', 4), character('high', '高星', 6)]} imageBasePath="/images/characters" selectedIds={['high']} onSelect={() => undefined} />)
  const high = screen.getByRole('button', { name: '高星' })
  const low = screen.getByRole('button', { name: '低星' })
  expect(high.compareDocumentPosition(low) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(high.getAttribute('aria-pressed')).toBe('true')
  expect(screen.getAllByTestId('rarity-frame')).toHaveLength(2)
  expect(high.className).toContain('self-start')
  expect(high.parentElement?.className).toContain('content-start')
  expect(high.parentElement?.className).toContain('items-start')
})

it('filters the graphical list by localized name', () => {
  render(<WikiEntityPicker title="干员" entities={[character('one', '佩丽卡', 6), character('two', '陈千语', 5)]} imageBasePath="/images/characters" selectedIds={[]} onSelect={() => undefined} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'wiki.searchPlaceholder' }), { target: { value: '佩丽卡' } })
  expect(screen.getByRole('button', { name: '佩丽卡' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '陈千语' })).toBeNull()
})

it('sorts enum filter chips by their localized labels', () => {
  const entities = [character('physical', '物理', 5), { ...character('natural', '自然', 5), elementId: 'Natural' }]
  render(<WikiEntityPicker title="干员" entities={entities} imageBasePath="/images/characters" selectedIds={[]} onSelect={() => undefined} filters={[{ field: 'elementId', labelKey: 'wiki.filter.element', enumGroup: 'elements' }]} />)
  fireEvent.click(screen.getByRole('button', { name: 'wiki.filterToggle' }))
  const natural = screen.getByRole('button', { name: '自然' })
  const physical = screen.getByRole('button', { name: '物理' })
  expect(physical.compareDocumentPosition(natural) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('applies the requested selection tone and enables tooltip interaction', () => {
  render(<WikiEntityPicker title="干员" entities={[character('high', '高星', 6)]} imageBasePath="/images/characters" selectedIds={['high']} onSelect={() => undefined} selectionTone="amber" renderTooltip={() => <span>角色预览</span>} />)
  const selected = screen.getByRole('button', { name: '高星' })
  expect(selected.className).toContain('ring-amber-400')
  expect(selected.getAttribute('data-slot')).toBe('tooltip-trigger')
})
