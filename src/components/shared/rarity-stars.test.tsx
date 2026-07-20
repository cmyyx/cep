// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getRarityBandSrc, getRarityColorClass, normalizeRarity, RarityStars } from './rarity-stars'

afterEach(cleanup)

describe('RarityStars', () => {
  it.each([
    [1, 'text-rarity-1-star'],
    [2, 'text-rarity-2-star'],
    [3, 'text-rarity-3-star'],
    [4, 'text-rarity-4-star'],
    [5, 'text-rarity-5-star'],
    [6, 'text-rarity-6-star'],
  ] as const)('uses the configured color for %s-star rarity', (rarity, colorClass) => {
    render(<RarityStars rarity={rarity} />)

    const label = screen.getByRole('img', { name: `${rarity}★` })
    expect(label.classList.contains(colorClass)).toBe(true)
    expect(label.querySelectorAll('[data-slot="rarity-star"]')).toHaveLength(rarity)
  })

  it.each([undefined, null, Number.NaN, 0, 7, 2.5])(
    'normalizes invalid rarity %s to one star',
    (rarity) => {
      expect(normalizeRarity(rarity)).toBe(1)
      expect(getRarityColorClass(rarity)).toBe('text-rarity-1-star')
      expect(getRarityBandSrc(rarity)).toBe('/images/item-band-1.png')
    }
  )

  it.each([1, 2, 3, 4, 5, 6] as const)(
    'selects the matching band for %s-star rarity',
    (rarity) => {
      expect(getRarityBandSrc(rarity)).toBe(`/images/item-band-${rarity}.png`)
    }
  )

  it('renders one star when rarity is invalid', () => {
    render(<RarityStars rarity={0} />)

    const label = screen.getByRole('img', { name: '1★' })
    expect(label.classList.contains('text-rarity-1-star')).toBe(true)
    expect(label.querySelectorAll('[data-slot="rarity-star"]')).toHaveLength(1)
  })
})
