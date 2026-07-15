import { describe, it, expect, vi } from 'vitest'

const { mockManifest } = vi.hoisted(() => ({
  mockManifest: {} as Record<string, string>,
}))

vi.mock('@/generated/image-hash-manifest', () => ({
  imageHashManifest: mockManifest,
}))

import { withImageCacheVersion } from './image-url'

describe('withImageCacheVersion', () => {
  it('appends ?v= when hash exists for path', () => {
    mockManifest['/images/weapon/foo.avif'] = 'abc12345'
    expect(withImageCacheVersion('/images/weapon/foo.avif')).toBe(
      '/images/weapon/foo.avif?v=abc12345'
    )
  })

  it('uses & separator when path already has query string', () => {
    mockManifest['/images/weapon/foo.avif'] = 'abc12345'
    expect(
      withImageCacheVersion('/images/weapon/foo.avif?size=small')
    ).toBe('/images/weapon/foo.avif?size=small&v=abc12345')
  })

  it('returns path unchanged when no hash exists for path', () => {
    delete mockManifest['/images/weapon/foo.avif']
    expect(withImageCacheVersion('/images/weapon/foo.avif')).toBe(
      '/images/weapon/foo.avif'
    )
  })

  it('does not append separator when no hash exists even if path has query', () => {
    delete mockManifest['/images/weapon/foo.avif']
    expect(
      withImageCacheVersion('/images/weapon/foo.avif?size=small')
    ).toBe('/images/weapon/foo.avif?size=small')
  })
})
