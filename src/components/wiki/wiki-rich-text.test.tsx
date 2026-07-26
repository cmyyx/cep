// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveGlossaryText, WikiRichText } from './wiki-rich-text'
import type { WikiRichTextTerm } from '@/types/wiki'

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
}))

const catalogState: { loaded: boolean } = { loaded: true }

vi.mock('@/hooks/use-game-i18n-catalogs', () => ({
  useGameI18nLocale: () =>
    catalogState.loaded
      ? {
        characters: {},
        weapons: {},
        equips: {},
        equipStats: {},
        wikiData: {
          'glossary|ba%2Econsume|name': 'Consume',
          'glossary|ba%2Econsume|description': 'Consume description',
        },
      }
      : null,
}))

describe('WikiRichText', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    catalogState.loaded = true
  })

  it('renders supported style tags with controlled semantic classes', () => {
    render(<WikiRichText value="Damage <@ba.vup>+20%</>" />)

    expect(screen.getByText('+20%').classList.contains('text-develop-blue')).toBe(true)
  })

  it('renders verified glossary tags as accessible tooltip triggers', () => {
    render(<WikiRichText value="Apply <#ba.consume>Consume</>" />)

    expect(screen.getByRole('button', { name: 'Consume' })).toBeTruthy()
  })

  it('still renders glossary triggers before the locale catalog loads', () => {
    catalogState.loaded = false
    render(<WikiRichText value="Apply <#ba.consume>Consume</>" />)

    expect(screen.getByRole('button', { name: 'Consume' })).toBeTruthy()
  })

  it('falls back to the bundled glossary text instead of the raw lookup key', () => {
    const term: WikiRichTextTerm = {
      name: { 'zh-CN': '状态消耗', en: 'Debuff Consumption', ja: '状態消費', 'zh-TW': '狀態消耗' },
      description: { 'zh-CN': '说明', en: 'Description', ja: '説明', 'zh-TW': '說明' },
      styleId: '',
    }

    expect(resolveGlossaryText(term, 'name', 'en', 'Consume')).toBe('Consume')
    expect(resolveGlossaryText(term, 'name', 'en', undefined)).toBe('Debuff Consumption')
    expect(resolveGlossaryText(term, 'description', 'ja', '')).toBe('説明')
    expect(resolveGlossaryText({ ...term, name: { ...term.name, en: '' } }, 'name', 'en', null)).toBe('状态消耗')
  })

  it('renders unknown glossary tags as plain text', () => {
    render(<WikiRichText value="Apply <#unknown.term>Unknown</>" />)

    expect(screen.getByText('Unknown').tagName).toBe('SPAN')
    expect(screen.queryByRole('button', { name: 'Unknown' })).toBeNull()
  })
})
