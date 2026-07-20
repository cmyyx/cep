// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RarityFrame } from './rarity-frame'

afterEach(cleanup)

describe('RarityFrame', () => {
  it('renders the frame, entity image, matching rarity band, title, and badges', () => {
    render(
      <RarityFrame
        imageSrc="/images/test-item.png"
        title="Test item"
        rarity={4}
        badges={<span>UP</span>}
      />
    )

    expect(screen.getByTestId('rarity-frame')).toBeTruthy()
    expect(screen.getByTestId('rarity-frame-background').getAttribute('src')).toBe(
      '/images/item-frame-bg.png'
    )
    expect(screen.getByRole('img', { name: 'Test item' }).getAttribute('src')).toMatch(
      /\/images\/test-item\.png$/
    )
    expect(screen.getByTestId('rarity-frame-band').getAttribute('src')).toBe(
      '/images/item-band-4.png'
    )
    expect(screen.getByText('Test item')).toBeTruthy()
    expect(screen.getByText('UP')).toBeTruthy()
  })

  it('supports a category-specific background', () => {
    render(
      <RarityFrame
        imageSrc="/images/test-character.png"
        backgroundSrc="/images/character-frame-bg.png"
        title="Test character"
        rarity={6}
      />
    )

    expect(screen.getByTestId('rarity-frame-background').getAttribute('src')).toBe(
      '/images/character-frame-bg.png'
    )
  })

  it('uses the one-star band when rarity is missing or invalid', () => {
    const { rerender } = render(
      <RarityFrame imageSrc="/images/test-item.png" title="Test item" />
    )

    expect(screen.getByTestId('rarity-frame-band').getAttribute('src')).toBe(
      '/images/item-band-1.png'
    )

    rerender(<RarityFrame imageSrc="/images/test-item.png" title="Test item" rarity={99} />)
    expect(screen.getByTestId('rarity-frame-band').getAttribute('src')).toBe(
      '/images/item-band-1.png'
    )
  })

  it('preserves frame, title, and rarity band when the entity image errors', () => {
    render(
      <RarityFrame
        imageSrc="/images/missing-item.png"
        title="Missing item"
        rarity={6}
      />
    )

    fireEvent.error(screen.getByRole('img', { name: 'Missing item' }))

    expect(screen.queryByRole('img', { name: 'Missing item' })).toBeNull()
    expect(screen.getByTestId('rarity-frame-background')).toBeTruthy()
    expect(screen.getByTestId('rarity-frame-band').getAttribute('src')).toBe(
      '/images/item-band-6.png'
    )
    expect(screen.getByText('Missing item')).toBeTruthy()
    expect(screen.getByTestId('rarity-frame-fallback').textContent).toBe('M')
  })
  it('restores the entity image when its source changes after an error', () => {
    const { rerender } = render(
      <RarityFrame imageSrc="/images/missing-item.png" title="Test item" rarity={4} />
    )

    fireEvent.error(screen.getByRole('img', { name: 'Test item' }))
    expect(screen.queryByRole('img', { name: 'Test item' })).toBeNull()

    rerender(<RarityFrame imageSrc="/images/other-item.png" title="Test item" rarity={4} />)
    expect(screen.getByRole('img', { name: 'Test item' }).getAttribute('src')).toMatch(
      /\/images\/other-item\.png$/
    )
  })
})
