// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RarityFrame } from './rarity-frame'
vi.mock('@/generated/image-hash-manifest', () => ({ imageHashManifest: {} }))

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
    expect(screen.getByTestId('rarity-frame-image').getAttribute('src')).toMatch(
      /\/images\/test-item\.png$/
    )
    expect(screen.getByTestId('rarity-frame-band').getAttribute('src')).toBe(
      '/images/item-band-4.png'
    )
    expect(screen.getByText('Test item')).toBeTruthy()
    expect(screen.getByText('UP')).toBeTruthy()
  })

  it('keeps the artwork decorative while a visible title names the frame', () => {
    render(<RarityFrame imageSrc="/images/test-item.png" title="Test item" rarity={4} />)

    // A screen reader must announce "Test item" once (the <h3>), not twice.
    expect(screen.getByTestId('rarity-frame-image').getAttribute('alt')).toBe('')
    expect(screen.queryAllByRole('img', { name: 'Test item' })).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Test item' })).toBeTruthy()
  })

  it('names the artwork when no visible title is rendered', () => {
    render(
      <RarityFrame imageSrc="/images/test-item.png" title="Test item" rarity={4} showTitle={false} />
    )

    expect(screen.getByRole('img', { name: 'Test item' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Test item' })).toBeNull()
  })

  it('lets the caller force an empty alt when it renders the name itself', () => {
    render(
      <RarityFrame
        imageSrc="/images/test-item.png"
        title="Test item"
        rarity={4}
        showTitle={false}
        imageAlt=""
      />
    )

    expect(screen.getByTestId('rarity-frame-image').getAttribute('alt')).toBe('')
    expect(screen.queryAllByRole('img', { name: 'Test item' })).toHaveLength(0)
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

    fireEvent.error(screen.getByTestId('rarity-frame-image'))

    expect(screen.queryByTestId('rarity-frame-image')).toBeNull()
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

    fireEvent.error(screen.getByTestId('rarity-frame-image'))
    expect(screen.queryByTestId('rarity-frame-image')).toBeNull()

    rerender(<RarityFrame imageSrc="/images/other-item.png" title="Test item" rarity={4} />)
    expect(screen.getByTestId('rarity-frame-image').getAttribute('src')).toMatch(
      /\/images\/other-item\.png$/
    )
  })
})
