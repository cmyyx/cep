import type { Metadata } from 'next'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: '--font-sans' }),
  Geist_Mono: () => ({ variable: '--font-geist-mono' }),
}))

// `loadMetadata` re-imports the root layout module graph after
// `vi.resetModules()`. The layout imports `./globals.css`, so every re-import
// otherwise pays a full Tailwind transform — the dominant cost, and irrelevant
// here because this suite only asserts on `metadata`. Stubbing it keeps the
// import in the tens of milliseconds even under a loaded full-suite run.
vi.mock('./globals.css', () => ({}))

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

/**
 * `loadMetadata` re-imports the whole root layout module graph after
 * `vi.resetModules()`, which includes `globals.css` and therefore a full
 * Tailwind transform. In isolation that is under a second, but under a loaded
 * full-suite run (191 files in parallel) it has been observed to exceed the
 * global 15 s budget, so these three get an explicit, generous timeout.
 * The timeout is not masking a hang: each call resolves in ~1 s on an idle
 * machine.
 */
const IMPORT_HEAVY_TIMEOUT_MS = 60_000

describe('root layout SEO metadata', () => {
  it('adds noindex and nofollow when SEO_INDEXABLE is not enabled', async () => {
    const metadata = await loadMetadata('false')
    expect(metadata.robots).toEqual({ index: false, follow: false })
  }, IMPORT_HEAVY_TIMEOUT_MS)

  it('defaults to noindex and nofollow when SEO_INDEXABLE is unset', async () => {
    const metadata = await loadMetadata(undefined)
    expect(metadata.robots).toEqual({ index: false, follow: false })
  }, IMPORT_HEAVY_TIMEOUT_MS)

  it('omits robots restrictions for the explicit indexable build', async () => {
    const metadata = await loadMetadata('true')
    expect(metadata.robots).toBeUndefined()
  }, IMPORT_HEAVY_TIMEOUT_MS)
})

describe('root layout app-init-done script', () => {
  const source = readFileSync(path.join(here, 'layout.tsx'), 'utf-8')

  it('uses the shared script module instead of inlining its own copy', () => {
    expect(source).toContain("from '@/lib/app-init-done-script'")
    expect(source).toContain('code={APP_INIT_DONE_SCRIPT}')
  })

  it('never hardcodes the storage key (it must come from @/lib/constants)', () => {
    // The layout cannot import the zustand store, and the script module cannot
    // import zustand — APP_INIT_STORAGE_KEY in @/lib/constants is the contract
    // between them. A literal here would silently drift from the store.
    expect(source).not.toContain("'cep-app-init'")
    expect(source).not.toContain('"cep-app-init"')
  })

  it('has a matching CSS rule so the curtain is never painted on a repeat visit', () => {
    const css = readFileSync(path.join(here, 'globals.css'), 'utf-8')
    expect(css).toContain('html[data-cep-init-done] [data-app-init]')
    expect(css).toContain('display: none !important;')
  })
})
