import type { Metadata } from 'next'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: '--font-sans' }),
  Geist_Mono: () => ({ variable: '--font-geist-mono' }),
}))

const originalSeoIndexable = process.env.SEO_INDEXABLE

async function loadMetadata(value: string | undefined): Promise<Metadata> {
  if (value === undefined) {
    delete process.env.SEO_INDEXABLE
  } else {
    process.env.SEO_INDEXABLE = value
  }
  vi.resetModules()
  const layoutModule = await import('./layout')
  return layoutModule.metadata
}

afterEach(() => {
  if (originalSeoIndexable === undefined) {
    delete process.env.SEO_INDEXABLE
  } else {
    process.env.SEO_INDEXABLE = originalSeoIndexable
  }
  vi.resetModules()
})

describe('root layout SEO metadata', () => {
  it('adds noindex and nofollow when SEO_INDEXABLE is not enabled', async () => {
    const metadata = await loadMetadata('false')
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('omits robots restrictions for the explicit indexable build', async () => {
    const metadata = await loadMetadata('true')
    expect(metadata.robots).toBeUndefined()
  })
})
