// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { WallpaperMediaFrame } from './wallpaper-media-frame'

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}))

afterEach(cleanup)

it('preserves the unavailable state, badge, aspect ratio, and tone height cap', () => {
  const { container } = render(
    <WallpaperMediaFrame
      tone="history"
      aspectRatio={0.75}
      failed
      imageUrl={null}
      sizes="100vw"
      unavailableLabel="Image unavailable"
      badge={<span>Updated</span>}
      onLoad={() => {}}
      onError={() => {}}
    />,
  )

  const frame = container.firstElementChild
  expect(frame?.className).toContain('max-h-[min(36svh,14rem)]')
  expect(frame?.getAttribute('data-aspect-ratio')).toBe('0.7500')
  expect(frame?.getAttribute('style')).toContain('aspect-ratio')
  expect(screen.getByText('Image unavailable')).toBeTruthy()
  expect(screen.getByText('Updated')).toBeTruthy()
})
