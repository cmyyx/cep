import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockManifest } = vi.hoisted(() => ({
  mockManifest: {} as Record<string, string>,
}))

vi.mock('@/generated/image-hash-manifest', () => ({
  imageHashManifest: mockManifest,
}))

import { withImageCacheVersion } from './image-url'

describe('withImageCacheVersion', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockManifest)) {
      delete mockManifest[key]
    }
  })

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

  it('inserts version before fragment', () => {
    mockManifest['/images/weapon/foo.avif'] = 'abc12345'
    expect(
      withImageCacheVersion('/images/weapon/foo.avif#section')
    ).toBe('/images/weapon/foo.avif?v=abc12345#section')
  })

  it('inserts version before fragment when query also present', () => {
    mockManifest['/images/weapon/foo.avif'] = 'abc12345'
    expect(
      withImageCacheVersion('/images/weapon/foo.avif?size=small#section')
    ).toBe('/images/weapon/foo.avif?size=small&v=abc12345#section')
  })

  it('decodes URL-encoded path for manifest lookup', () => {
    mockManifest['/images/weapon/中文.avif'] = 'abc12345'
    expect(
      withImageCacheVersion('/images/weapon/%E4%B8%AD%E6%96%87.avif')
    ).toBe('/images/weapon/%E4%B8%AD%E6%96%87.avif?v=abc12345')
  })

  it('falls back to raw path when decodeURIComponent fails', () => {
    mockManifest['/images/weapon/%E.avif'] = 'abc12345'
    expect(withImageCacheVersion('/images/weapon/%E.avif')).toBe(
      '/images/weapon/%E.avif?v=abc12345'
    )
  })

  it('returns path unchanged when no hash exists for path', () => {
    expect(withImageCacheVersion('/images/weapon/foo.avif')).toBe(
      '/images/weapon/foo.avif'
    )
  })

  it('does not append separator when no hash exists even if path has query', () => {
    expect(
      withImageCacheVersion('/images/weapon/foo.avif?size=small')
    ).toBe('/images/weapon/foo.avif?size=small')
  })

  it('returns path unchanged when no hash exists and path has fragment', () => {
    expect(
      withImageCacheVersion('/images/weapon/foo.avif#section')
    ).toBe('/images/weapon/foo.avif#section')
  })
})
