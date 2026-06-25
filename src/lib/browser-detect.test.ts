// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { detectBrowserIssues, isCritical, type DocumentLike, type StyleElementLike } from './browser-detect'

// ── Helpers ──

function modernJsScope() {
  return {
    Promise: globalThis.Promise as unknown,
    WeakSet: globalThis.WeakSet as unknown,
    Proxy: globalThis.Proxy as unknown,
  }
}

function allSupported(): boolean {
  return true
}

/** At-rule / nesting probe strings — mirror the strings in browser-detect.ts. */
const LAYER_RULE = '@layer cep-probe{}'
const CONTAINER_RULE = '@container cep-probe(min-width:0){}'
const PROPERTY_RULE = '@property --cep-probe{syntax:"<length>";inherits:false;initial-value:0px}'
const NESTING_RULE = '.cep-probe{&{color:red}}'
const ALL_PROBE_RULES = [LAYER_RULE, CONTAINER_RULE, PROPERTY_RULE, NESTING_RULE]

/**
 * Build a mock document whose injected <style> reports a non-empty cssRules
 * list when its textContent matches one of `parseableRules`, and an empty
 * list otherwise. Defaults to "all rules parse" (modern browser).
 */
function makeDocMock(parseableRules: string[] = ALL_PROBE_RULES): DocumentLike {
  return {
    createElement: () => {
      let text = ''
      const style = {
        get textContent() { return text },
        set textContent(v: string) { text = v },
        get sheet() {
          return parseableRules.includes(text)
            ? { cssRules: [{}] as ArrayLike<unknown> }
            : { cssRules: [] as ArrayLike<unknown> }
        },
        remove: () => {},
      } as StyleElementLike
      return style
    },
    head: { appendChild: () => {} },
    documentElement: { appendChild: () => {} },
  }
}

/** Mock document whose every <style> reports `sheet: null` (CSSOM broken). */
function makeNullSheetDocMock(): DocumentLike {
  return {
    createElement: () => ({ textContent: '', sheet: null, remove: () => {} }),
    head: { appendChild: () => {} },
  }
}

/** Mock document whose createElement throws on every call. */
function makeThrowingDocMock(): DocumentLike {
  return {
    createElement: () => { throw new Error('nope') },
  }
}

// ── Tests: detectBrowserIssues ──

describe('detectBrowserIssues', () => {
  it('returns empty array for a fully capable scope', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      document: makeDocMock(),
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
      document: makeDocMock(),
    })
    expect(issues).toEqual(['CSS_VARS'])
  })

  it('detects missing :where() selector support', () => {
    const fakeSupports = (cond: string) =>
      cond === 'selector(:where(*))' ? false : true
    const issues = detectBrowserIssues({
      CSS: { supports: fakeSupports },
      ...modernJsScope(),
      document: makeDocMock(),
    })
    expect(issues).toEqual(['CSS_WHERE'])
  })

  it('detects missing :has() selector support', () => {
    const fakeSupports = (cond: string) =>
      cond === 'selector(:has(*))' ? false : true
    const issues = detectBrowserIssues({
      CSS: { supports: fakeSupports },
      ...modernJsScope(),
      document: makeDocMock(),
    })
    expect(issues).toEqual(['CSS_HAS'])
  })

  it('detects missing oklch() support', () => {
    const fakeSupports = (cond: string) =>
      cond === 'color: oklch(0 0 0)' ? false : true
    const issues = detectBrowserIssues({
      CSS: { supports: fakeSupports },
      ...modernJsScope(),
      document: makeDocMock(),
    })
    expect(issues).toEqual(['CSS_OKLCH'])
  })

  it('detects missing color-mix() support', () => {
    const fakeSupports = (cond: string) =>
      cond === 'color: color-mix(in srgb, red, blue)' ? false : true
    const issues = detectBrowserIssues({
      CSS: { supports: fakeSupports },
      ...modernJsScope(),
      document: makeDocMock(),
    })
    expect(issues).toEqual(['CSS_COLOR_MIX'])
  })

  it('detects multiple CSS.supports gaps together', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: () => false },
      ...modernJsScope(),
      document: makeDocMock(),
    })
    expect(issues).toEqual(expect.arrayContaining([
      'CSS_VARS', 'CSS_WHERE', 'CSS_HAS', 'CSS_OKLCH', 'CSS_COLOR_MIX',
    ]))
    expect(issues).not.toContain('CSS_API')
  })

  it('detects missing Promise', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      document: makeDocMock(),
      Promise: undefined,
    })
    expect(issues).toEqual(['PROMISE'])
  })

  it('detects missing WeakSet', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      document: makeDocMock(),
      WeakSet: undefined,
    })
    expect(issues).toEqual(['WEAKSET'])
  })

  it('detects missing Proxy', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      document: makeDocMock(),
      Proxy: undefined,
    })
    expect(issues).toEqual(['PROXY'])
  })

  it('detects multiple JS API gaps', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      document: makeDocMock(),
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

  it('survives supports() throwing', () => {
    const issues = detectBrowserIssues({
      CSS: {
        supports: () => {
          throw new Error('boom')
        },
      } as unknown as { supports: (c: string) => boolean },
      ...modernJsScope(),
    })
    expect(issues).toContain('CSS_API')
  })

  // ── At-rule / nesting probes ──

  it('detects CSS_LAYER when @layer rule is dropped', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      document: makeDocMock(ALL_PROBE_RULES.filter(r => r !== LAYER_RULE)),
    })
    expect(issues).toEqual(['CSS_LAYER'])
  })

  it('detects CSS_CONTAINER when @container rule is dropped', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      document: makeDocMock(ALL_PROBE_RULES.filter(r => r !== CONTAINER_RULE)),
    })
    expect(issues).toEqual(['CSS_CONTAINER'])
  })

  it('detects CSS_PROPERTY when @property rule is dropped', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      document: makeDocMock(ALL_PROBE_RULES.filter(r => r !== PROPERTY_RULE)),
    })
    expect(issues).toEqual(['CSS_PROPERTY'])
  })

  it('detects CSS_NESTING when & selector is dropped', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      document: makeDocMock(ALL_PROBE_RULES.filter(r => r !== NESTING_RULE)),
    })
    expect(issues).toEqual(['CSS_NESTING'])
  })

  it('detects all at-rule gaps when cssRules is empty', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      document: makeDocMock([]),
    })
    expect(issues).toEqual(['CSS_LAYER', 'CSS_CONTAINER', 'CSS_PROPERTY', 'CSS_NESTING'])
  })

  it('detects all at-rule gaps when sheet is null', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      document: makeNullSheetDocMock(),
    })
    expect(issues).toEqual(['CSS_LAYER', 'CSS_CONTAINER', 'CSS_PROPERTY', 'CSS_NESTING'])
  })

  it('detects all at-rule gaps when createElement throws', () => {
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
      document: makeThrowingDocMock(),
    })
    expect(issues).toEqual(['CSS_LAYER', 'CSS_CONTAINER', 'CSS_PROPERTY', 'CSS_NESTING'])
  })

  it('skips at-rule probes when document is omitted', () => {
    // Callers that don't pass document must not see at-rule issues.
    const issues = detectBrowserIssues({
      CSS: { supports: allSupported },
      ...modernJsScope(),
    })
    expect(issues).toEqual([])
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

  it('returns true for CSS_WHERE alone', () => {
    expect(isCritical(['CSS_WHERE'])).toBe(true)
  })

  it('returns true for CSS_HAS alone', () => {
    expect(isCritical(['CSS_HAS'])).toBe(true)
  })

  it('returns true for CSS_OKLCH alone', () => {
    expect(isCritical(['CSS_OKLCH'])).toBe(true)
  })

  it('returns true for CSS_COLOR_MIX alone', () => {
    expect(isCritical(['CSS_COLOR_MIX'])).toBe(true)
  })

  it('returns true for CSS_LAYER alone', () => {
    expect(isCritical(['CSS_LAYER'])).toBe(true)
  })

  it('returns true for CSS_CONTAINER alone', () => {
    expect(isCritical(['CSS_CONTAINER'])).toBe(true)
  })

  it('returns true for CSS_PROPERTY alone', () => {
    expect(isCritical(['CSS_PROPERTY'])).toBe(true)
  })

  it('returns true for CSS_NESTING alone', () => {
    expect(isCritical(['CSS_NESTING'])).toBe(true)
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

  it('returns true for AVIF alone', () => {
    expect(isCritical(['AVIF'])).toBe(true)
  })

  it('returns true when AVIF mixed with JS gaps', () => {
    expect(isCritical(['AVIF', 'PROMISE'])).toBe(true)
  })

  it('returns true when CSS_LAYER mixed with JS gaps', () => {
    expect(isCritical(['CSS_LAYER', 'PROMISE'])).toBe(true)
  })

  it('returns true when all critical CSS issues present', () => {
    expect(isCritical([
      'CSS_API', 'CSS_VARS', 'CSS_WHERE', 'CSS_HAS', 'CSS_OKLCH',
      'CSS_COLOR_MIX', 'CSS_LAYER', 'CSS_CONTAINER', 'CSS_PROPERTY', 'CSS_NESTING',
    ])).toBe(true)
  })
})
