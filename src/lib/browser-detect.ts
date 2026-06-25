/**
 * Browser capability detection — pure functions for unit testing.
 *
 * The minified IIFE string (BROWSER_DETECT_CODE) mirrors this logic
 * for inline <script> injection. Changes to detectBrowserIssues()
 * MUST be reflected in BROWSER_DETECT_CODE.
 *
 * Tested by browser-detect.test.ts via mocking global scope.
 */

export type BrowserIssue =
  | 'CSS_API'         // CSS.supports() not available
  | 'CSS_VARS'        // CSS custom properties not supported
  | 'CSS_WHERE'       // :where() selector not supported
  | 'CSS_HAS'         // :has() selector not supported (card.tsx layout)
  | 'CSS_OKLCH'       // oklch() color function not supported (globals.css --destructive)
  | 'CSS_COLOR_MIX'   // color-mix() not supported (Tailwind v4 opacity modifiers)
  | 'CSS_LAYER'       // @layer at-rule not supported (Tailwind v4 hard-depends on it)
  | 'CSS_CONTAINER'   // @container at-rule not supported (card.tsx container queries)
  | 'CSS_PROPERTY'    // @property at-rule not supported (Tailwind v4 animation vars)
  | 'CSS_NESTING'     // CSS nesting (&) not supported (Tailwind v4 generates nested CSS)
  | 'PROMISE'         // Promise not available
  | 'WEAKSET'         // WeakSet not available
  | 'PROXY'           // Proxy not available
  | 'AVIF'            // AVIF image format not supported

/** Minimal <style> element shape for the @layer probe. */
export interface StyleElementLike {
  textContent: string
  sheet: { cssRules: ArrayLike<unknown> } | null
  remove: () => void
}

/** Minimal document shape consumed by the @layer probe. */
export interface DocumentLike {
  createElement: (tag: string) => StyleElementLike
  head?: { appendChild: (n: StyleElementLike) => void } | null
  documentElement?: { appendChild: (n: StyleElementLike) => void } | null
}

interface DetectScope {
  CSS?: { supports?: (cond: string) => boolean } | null
  Promise?: unknown
  WeakSet?: unknown
  Proxy?: unknown
  /** When omitted, the @layer probe is skipped (back-compat with existing tests). */
  document?: DocumentLike | null
}

/**
 * Pure detection — takes a scope resembling window/globalThis.
 * Returns codes for any missing critical features. Empty = browser is fine.
 */
export function detectBrowserIssues(scope: DetectScope): BrowserIssue[] {
  const issues: BrowserIssue[] = []

  // ── CSS checks ──
  let hasCssApi = false
  try {
    hasCssApi = typeof scope.CSS !== 'undefined' && typeof scope.CSS?.supports === 'function'
  } catch { /* CSS object threw — treat as missing */ }

  if (!hasCssApi) {
    issues.push('CSS_API')
  } else {
    const s = scope.CSS!.supports!
    try {
      if (!s('(--custom:1)'))                  issues.push('CSS_VARS')
      if (!s('selector(:where(*))'))           issues.push('CSS_WHERE')
      if (!s('selector(:has(*))'))             issues.push('CSS_HAS')
      if (!s('color: oklch(0 0 0)'))           issues.push('CSS_OKLCH')
      if (!s('color: color-mix(in srgb, red, blue)')) issues.push('CSS_COLOR_MIX')
    } catch {
      issues.push('CSS_API')
    }
  }

  // ── JS API checks ──
  if (typeof scope.Promise === 'undefined')   issues.push('PROMISE')
  if (typeof scope.WeakSet === 'undefined')   issues.push('WEAKSET')
  if (typeof scope.Proxy === 'undefined')     issues.push('PROXY')

  // ── At-rule / nesting probes ──
  // CSS.supports() cannot detect at-rules; inject <style> and inspect cssRules.
  // Browsers that don't recognize an at-rule silently drop it (length stays 0).
  if (scope.document) {
    const probe = (rule: string): boolean => {
      try {
        const style = scope.document!.createElement('style')
        style.textContent = rule
        const mount = scope.document!.head ?? scope.document!.documentElement
        mount?.appendChild(style)
        const ok = !!style.sheet && style.sheet.cssRules.length > 0
        style.remove()
        return ok
      } catch {
        return false
      }
    }
    if (!probe('@layer cep-probe{}'))                                        issues.push('CSS_LAYER')
    if (!probe('@container cep-probe(min-width:0){}'))                        issues.push('CSS_CONTAINER')
    if (!probe('@property --cep-probe{syntax:"<length>";inherits:false;initial-value:0px}')) issues.push('CSS_PROPERTY')
    if (!probe('.cep-probe{&{color:red}}'))                                  issues.push('CSS_NESTING')
  }

  return issues
}

/**
 * Returns true if the issues list contains a deal-breaker that will prevent
 * the page from rendering at all (no CSS custom properties, no CSS API).
 */
export function isCritical(issues: BrowserIssue[]): boolean {
  return issues.includes('CSS_API')
    || issues.includes('CSS_VARS')
    || issues.includes('CSS_WHERE')
    || issues.includes('CSS_HAS')
    || issues.includes('CSS_OKLCH')
    || issues.includes('CSS_COLOR_MIX')
    || issues.includes('CSS_LAYER')
    || issues.includes('CSS_CONTAINER')
    || issues.includes('CSS_PROPERTY')
    || issues.includes('CSS_NESTING')
    || issues.includes('AVIF')
}

/**
 * Recommended minimum versions displayed to the user.
 *
 * Computed from the highest minimum across all detected features:
 *   - CSS nesting (&)        → Chrome 112 / Edge 112 / Firefox 117 / Safari 16.5
 *   - @property               → Firefox 128 / Safari 16.4
 *   - color-mix() / oklch()  → Chrome 111 / Edge 111 / Firefox 113 / Safari 16.2
 *   - :has()                 → Chrome 105 / Edge 105 / Firefox 121 / Safari 15.4
 *   - @container             → Chrome 105 / Edge 105 / Firefox 110 / Safari 16.0
 *   - @layer                 → Chrome 99  / Edge 99  / Firefox 97  / Safari 15.4
 *   - AVIF (still image)     → Chrome 85  / Edge 85  / Firefox 93  / Safari 16.0
 *
 * The binding constraint per browser:
 *   Chrome / Edge → 112 (CSS nesting)
 *   Firefox       → 128 (@property)
 *   Safari        → 16.5 (CSS nesting)
 */
export const RECOMMENDED_BROWSERS =
  'Chrome 112+ / Firefox 128+ / Safari 16.5+ / Edge 112+'

// ═══════════════════════════════════════════════════════════════
// AVIF probe — 1x1 pixel AVIF for async capability detection
// ═══════════════════════════════════════════════════════════════

export const AVIF_PROBE_DATA =
  'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAOptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAImlsb2MAAAAAREAAAQABAAAAAAEOAAEAAAAAAAAAGAAAACNpaW5mAAAAAAABAAAAFWluZmUCAAAAAAEAAGF2MDEAAAAAamlwcnAAAABLaXBjbwAAAAxhdjFDgSACAAAAABNjb2xybmNseAABAA0AAYAAAAAUaXNwZQAAAAAAAAABAAAAAQAAABBwaXhpAAAAAAMICAgAAAAXaXBtYQAAAAAAAAABAAEEgQIDBAAAACBtZGF0EgAKBzgABlAQ0BkyCxZAAABAAAB5S6v2'

// ═══════════════════════════════════════════════════════════════
// Minified IIFE — mirrors detectBrowserIssues exactly.
// Used by BrowserGuard for inline <script> injection.
// ═══════════════════════════════════════════════════════════════

export const BROWSER_DETECT_CODE = `(function s(){
var i=[];
var h=false;
try{h=typeof CSS!=='undefined'&&typeof CSS.supports==='function'}catch(e){}
if(!h){i.push('CSS_API')}
else{
  try{
    if(!CSS.supports('(--custom:1)'))i.push('CSS_VARS');
    if(!CSS.supports('selector(:where(*))'))i.push('CSS_WHERE');
    if(!CSS.supports('selector(:has(*))'))i.push('CSS_HAS');
    if(!CSS.supports('color: oklch(0 0 0)'))i.push('CSS_OKLCH');
    if(!CSS.supports('color: color-mix(in srgb, red, blue)'))i.push('CSS_COLOR_MIX')
  }catch(e){i.push('CSS_API')}
}
if(typeof Promise==='undefined')i.push('PROMISE');
if(typeof WeakSet==='undefined')i.push('WEAKSET');
if(typeof Proxy==='undefined')i.push('PROXY');
function _p(r){
  try{
    var s=document.createElement('style');
    s.textContent=r;
    (document.head||document.documentElement).appendChild(s);
    var ok=!!(s.sheet&&s.sheet.cssRules.length>0);
    s.remove();
    return ok
  }catch(e){return false}
}
if(!_p('@layer cep-probe{}'))i.push('CSS_LAYER');
if(!_p('@container cep-probe(min-width:0){}'))i.push('CSS_CONTAINER');
if(!_p('@property --cep-probe{syntax:"<length>";inherits:false;initial-value:0px}'))i.push('CSS_PROPERTY');
if(!_p('.cep-probe{&{color:red}}'))i.push('CSS_NESTING');
return i
})()`.replace(/\n\s*/g, '')
