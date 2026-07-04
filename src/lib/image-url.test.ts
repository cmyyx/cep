import { describe, it, expect, vi } from 'vitest'

const { mockVersionData } = vi.hoisted(() => ({
  mockVersionData: { imageCacheVersion: 'abc12345' },
}))

vi.mock('@/generated/version-data', () => ({
  versionData: mockVersionData,
}))

import { withImageCacheVersion } from './image-url'

describe('withImageCacheVersion', () => {
  it('appends ?v= when version is present', () => {
    mockVersionData.imageCacheVersion = 'abc12345'
    expect(withImageCacheVersion('/images/weapon/foo.avif')).toBe(
      '/images/weapon/foo.avif?v=abc12345'
    )
  })

  it('uses & separator when path already has query string', () => {
    mockVersionData.imageCacheVersion = 'abc12345'
    expect(
      withImageCacheVersion('/images/weapon/foo.avif?size=small')
    ).toBe('/images/weapon/foo.avif?size=small&v=abc12345')
  })

  it('returns path unchanged when version is empty', () => {
    mockVersionData.imageCacheVersion = ''
    expect(withImageCacheVersion('/images/weapon/foo.avif')).toBe(
      '/images/weapon/foo.avif'
    )
  })

  it('does not append separator when version is empty even if path has query', () => {
    mockVersionData.imageCacheVersion = ''
    expect(
      withImageCacheVersion('/images/weapon/foo.avif?size=small')
    ).toBe('/images/weapon/foo.avif?size=small')
  })
})
