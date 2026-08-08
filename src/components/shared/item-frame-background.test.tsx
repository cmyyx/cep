// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ItemFrameBackground } from './item-frame-background'

vi.mock('@/generated/image-hash-manifest', () => ({
  imageHashManifest: { '/images/item-frame-bg.png': 'abc12345' },
}))

it('uses the content version for the local frame artwork', () => {
  render(<ItemFrameBackground />)
  expect(screen.getByRole('presentation', { hidden: true }).getAttribute('src')).toBe('/images/item-frame-bg.png?v=abc12345')
})
