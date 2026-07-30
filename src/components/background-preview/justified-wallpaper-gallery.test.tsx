// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { JustifiedWallpaperGallery } from '@/components/background-preview/justified-wallpaper-gallery'

vi.mock('next/image', () => ({
  default: ({
    alt = '',
    src,
    onLoad,
  }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // Mimic automatic onLoad: the browser fires it when the image decodes.
    if (onLoad) {
      setTimeout(() => onLoad({ currentTarget: { naturalWidth: 1080, naturalHeight: 720 } } as React.SyntheticEvent<HTMLImageElement>), 0)
    }
    return <span role="img" aria-label={alt} data-src={String(src)} data-testid="wallpaper-image" />
  },
}))

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 400 })
})
afterEach(cleanup)

const aspectRatios = { '1': 16 / 9, '2': 4 / 3, '3': 1 }

it('renders images', async () => {
  render(
    <JustifiedWallpaperGallery
      items={[
        { id: '1', imageUrl: 'https://example.com/1.avif' },
        { id: '2', imageUrl: 'https://example.com/2.avif' },
        { id: '3', imageUrl: 'https://example.com/3.avif' },
      ]}
      aspectRatios={aspectRatios}
      failedImages={new Set()}
      sizes="100vw"
      onLoad={vi.fn()}
      onError={vi.fn()}
    />,
  )
  await waitFor(() => expect(screen.getAllByTestId('wallpaper-image')).toHaveLength(3))
})

it('renders placeholder for failed images', () => {
  render(
    <JustifiedWallpaperGallery
      items={[{ id: '1', imageUrl: null }]}
      aspectRatios={{}}
      failedImages={new Set(['1'])}
      sizes="100vw"
      onLoad={vi.fn()}
      onError={vi.fn()}
    />,
  )
  expect(screen.queryByTestId('wallpaper-image')).toBeNull()
})

it('renders null when items are empty', () => {
  const { container } = render(
    <JustifiedWallpaperGallery
      items={[]}
      aspectRatios={{}}
      failedImages={new Set()}
      sizes="100vw"
      onLoad={vi.fn()}
      onError={vi.fn()}
    />,
  )
  expect(container.firstChild).toBeNull()
})
