// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  detectBrowserIssues,
  isCritical,
  BROWSER_DETECT_CODE,
} from './browser-detect'
import type { BrowserIssue } from './browser-detect'

// ── Helpers ──

/** Provide a scope that has all JS APIs available (pass-through from globalThis).
 *  Use as base for tests that only want to vary CSS. */
function modernJsScope() {
  return {
    Promise: globalThis.Promise as unknown,
    WeakSet: globalThis.WeakSet as unknown,
    Proxy: globalThis.Proxy as unknown,
  }
}

/** Execute the minified IIFE in a controlled scope. */
function runDetectIIFE(
  overrides: Partial<{
    CSS: object | null | undefined
    Promise: unknown
    WeakSet: unknown
    Proxy: unknown
  }> = {},
): BrowserIssue[] {
  const sandbox = {
    CSS: globalThis.CSS as unknown,
    Promise: globalThis.Promise as unknown,
    WeakSet: globalThis.WeakSet as unknown,
    Proxy: globalThis.Proxy as unknown,
    ...overrides,
  }
  const fn = new Function(
    'CSS', 'Promise', 'WeakSet', 'Proxy',
    `return ${BROWSER_DETECT_CODE}`,
  )
  return fn(sandbox.CSS, sandbox.Promise, sandbox.WeakSet, sandbox.Proxy) as BrowserIssue[]
}

// A CSS.supports that says "yes" to everything (modern browser)
function allSupported(): boolean {
  return true
}

// ── Tests: detectBrowserIssues ──

describe('detectBrowserIssues', () => {
  it('returns empty array for a fully capable scope', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
    })
    expect(issues).toEqual([])
  })

  it('detects missing CSS API when CSS is undefined', () => {
    const issues = detectBrowserIssues({
      CSS: undefined,
      ...modernJsScope(),
    })
    expect(issues).toEqual(['CSS_API'])
    expect(issues).not.toContain('CSS_VARS')
    expect(issues).not.toContain('CSS_WHERE')
  })

  it('detects missing CSS API when CSS is null', () => {
    const issues = detectBrowserIssues({
      CSS: null,
      ...modernJsScope(),
    })
    expect(issues).toContain('CSS_API')
  })

  it('detects missing CSS API when CSS.supports is not a function', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: 42 as unknown as (c: string) => boolean },
      ...modernJsScope(),
    })
    expect(issues).toContain('CSS_API')
  })

  it('detects missing CSS custom properties', () => {
    const fakeSupports = (cond: string) =>
      cond === '(--custom:1)' ? false : true
    const issues = detectBrowserIssues({
      CSS: { supports: fakeSupports },
      ...modernJsScope(),
    })
    expect(issues).toEqual(['CSS_VARS'])
  })

  it('detects missing :where() selector support', () => {
    const fakeSupports = (cond: string) =>
      cond === 'selector(:where(*))' ? false : true
    const issues = detectBrowserIssues({
      CSS: { supports: fakeSupports },
      ...modernJsScope(),
    })
    expect(issues).toEqual(['CSS_WHERE'])
  })

  it('detects both CSS_VARS and CSS_WHERE when both missing', () => {
    const fakeSupports = () => false
    const issues = detectBrowserIssues({
      CSS: { supports: fakeSupports },
      ...modernJsScope(),
    })
    expect(issues).toContain('CSS_VARS')
    expect(issues).toContain('CSS_WHERE')
  })

  it('detects missing Promise', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      Promise: undefined,
    })
    expect(issues).toEqual(['PROMISE'])
  })

  it('detects missing WeakSet', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      WeakSet: undefined,
    })
    expect(issues).toEqual(['WEAKSET'])
  })

  it('detects missing Proxy', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      Proxy: undefined,
    })
    expect(issues).toEqual(['PROXY'])
  })

  it('detects multiple JS API gaps', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      Promise: undefined,
      WeakSet: undefined,
    })
    expect(issues).toContain('PROMISE')
    expect(issues).toContain('WEAKSET')
    expect(issues).not.toContain('PROXY')
  })

  it('detects combined CSS + JS failures (IE11-like)', () => {
    const issues = detectBrowserIssues({
      CSS: undefined,
      Promise: undefined,
      WeakSet: undefined,
      Proxy: undefined,
    })
    expect(issues).toEqual(['CSS_API', 'PROMISE', 'WEAKSET', 'PROXY'])
  })

  it('handles CSS object that throws on access', () => {
    const throwingCss = new Proxy({} as Record<string, unknown>, {
      get() {
        throw new Error('blocked')
      },
    })
    const issues = detectBrowserIssues({
      CSS: throwingCss as unknown as { supports: (c: string) => boolean },
      ...modernJsScope(),
    })
    expect(issues).toContain('CSS_API')
  })
})

// ── Tests: isCritical ──

describe('isCritical', () => {
  it('returns true for CSS_API', () => {
    expect(isCritical(['CSS_API'])).toBe(true)
  })

  it('returns true for CSS_VARS', () => {
    expect(isCritical(['CSS_VARS'])).toBe(true)
  })

  it('returns true when both CSS_API and CSS_VARS present', () => {
    expect(isCritical(['CSS_API', 'CSS_VARS'])).toBe(true)
  })

  it('returns false for CSS_WHERE alone', () => {
    expect(isCritical(['CSS_WHERE'])).toBe(false)
  })

  it('returns false for JS-only gaps', () => {
    expect(isCritical(['PROMISE'])).toBe(false)
    expect(isCritical(['WEAKSET', 'PROXY'])).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(isCritical([])).toBe(false)
  })

  it('returns true when CSS_API mixed with JS gaps', () => {
    expect(isCritical(['CSS_API', 'PROMISE', 'WEAKSET'])).toBe(true)
  })
})

// ── Tests: BROWSER_DETECT_CODE IIFE parity ──

describe('BROWSER_DETECT_CODE (IIFE parity)', () => {
  it('matches detectBrowserIssues on a fully capable scope', () => {
    // Pass the actual globalThis APIs — the IIFE reads bare globals via
    // function parameters, so we feed them in explicitly.
    const iife = runDetectIIFE()
    const pure = detectBrowserIssues({
      CSS: globalThis.CSS as unknown as { supports: (c: string) => boolean },
      Promise: globalThis.Promise,
      WeakSet: globalThis.WeakSet,
      Proxy: globalThis.Proxy,
    })
    expect(iife).toEqual(pure)
  })

  it('returns CSS_API when CSS is undefined', () => {
    const iife = runDetectIIFE({ CSS: undefined })
    expect(iife).toContain('CSS_API')
  })

  it('returns PROMISE when Promise is undefined', () => {
    const iife = runDetectIIFE({ Promise: undefined })
    expect(iife).toContain('PROMISE')
  })

  it('returns all codes for IE11-like scope', () => {
    const iife = runDetectIIFE({
      CSS: undefined,
      Promise: undefined,
      WeakSet: undefined,
      Proxy: undefined,
    })
    expect(iife).toEqual(['CSS_API', 'PROMISE', 'WEAKSET', 'PROXY'])
  })
})
