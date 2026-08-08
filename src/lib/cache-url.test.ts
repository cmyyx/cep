import { describe, expect, it } from 'vitest'
import { withCacheVersion } from './cache-url'

const manifest = {
  '/images/test.png': 'abc12345',
  '/game-i18n/zh-CN/000.json': 'def67890',
} as const

describe('withCacheVersion', () => {
  it('appends a version to a manifest path', () => {
    expect(withCacheVersion('/images/test.png', manifest)).toBe('/images/test.png?v=abc12345')
  })

  it('preserves existing query parameters and fragments', () => {
    expect(withCacheVersion('/images/test.png?size=small#preview', manifest)).toBe(
      '/images/test.png?size=small&v=abc12345#preview',
    )
  })

  it('replaces an existing version instead of duplicating it', () => {
    expect(withCacheVersion('/images/test.png?v=old&size=small', manifest)).toBe(
      '/images/test.png?v=abc12345&size=small',
    )
    expect(withCacheVersion('/images/test.png?v=abc12345', manifest)).toBe(
      '/images/test.png?v=abc12345',
    )
  })

  it('decodes encoded paths before looking them up', () => {
    expect(withCacheVersion('/game-i18n/zh-CN/%30%30%30.json', manifest)).toBe(
      '/game-i18n/zh-CN/%30%30%30.json?v=def67890',
    )
  })

  it('leaves paths outside the manifest unchanged', () => {
    expect(withCacheVersion('https://cdn.example.com/background.webp', manifest)).toBe(
      'https://cdn.example.com/background.webp',
    )
  })
})
