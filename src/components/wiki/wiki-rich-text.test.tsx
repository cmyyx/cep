// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WikiRichText } from './wiki-rich-text'

vi.mock('next-intl', () => ({ useLocale: () => 'en' }))

describe('WikiRichText', () => {
  beforeEach(() => document.body.replaceChildren())

  it('renders supported style tags with controlled semantic classes', () => {
    render(<WikiRichText value="Damage <@ba.vup>+20%</>" />)

    expect(screen.getByText('+20%').classList.contains('text-develop-blue')).toBe(true)
  })

  it('renders verified glossary tags as accessible tooltip triggers', () => {
    render(<WikiRichText value="Apply <#ba.consume>Consume</>" />)

    expect(screen.getByRole('button', { name: 'Consume' })).toBeTruthy()
  })

  it('renders unknown glossary tags as plain text', () => {
    render(<WikiRichText value="Apply <#unknown.term>Unknown</>" />)

    expect(screen.getByText('Unknown').tagName).toBe('SPAN')
    expect(screen.queryByRole('button', { name: 'Unknown' })).toBeNull()
  })
})
