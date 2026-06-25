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
  | 'CSS_API'       // CSS.supports() not available
  | 'CSS_VARS'      // CSS custom properties not supported
  | 'CSS_WHERE'     // :where() selector not supported
  | 'CSS_LAYER'     // @layer at-rule not supported (Tailwind v4 hard-depends on it)
  | 'PROMISE'       // Promise not available
  | 'WEAKSET'       // WeakSet not available
  | 'PROXY'         // Proxy not available
  | 'AVIF'          // AVIF image format not supported

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
      if (!s('(--custom:1)'))        issues.push('CSS_VARS')
      if (!s('selector(:where(*))')) issues.push('CSS_WHERE')
    } catch {
      issues.push('CSS_API')
    }
  }

  // ── JS API checks ──
  if (typeof scope.Promise === 'undefined')   issues.push('PROMISE')
  if (typeof scope.WeakSet === 'undefined')   issues.push('WEAKSET')
  if (typeof scope.Proxy === 'undefined')     issues.push('PROXY')

  // ── @layer probe ──
  // CSS.supports() cannot detect at-rules; inject a <style>@layer cep-probe{}</style>
  // and inspect sheet.cssRules.length. @layer is Chrome 99+ / Firefox 97+ / Safari 15.4+;
  // older engines silently drop the rule, leaving cssRules empty.
  if (scope.document) {
    try {
      const style = scope.document.createElement('style')
      style.textContent = '@layer cep-probe{}'
      const mount = scope.document.head ?? scope.document.documentElement
      mount?.appendChild(style)
      let layerOk = false
      if (style.sheet) {
        layerOk = style.sheet.cssRules.length > 0
      }
      style.remove()
      if (!layerOk) issues.push('CSS_LAYER')
    } catch {
      issues.push('CSS_LAYER')
    }
  }

  return issues
}

/**
 * Returns true if the issues list contains a deal-breaker that will prevent
 * the page from rendering at all (no CSS custom properties, no CSS API).
 */
export function isCritical(issues: BrowserIssue[]): boolean {
  return issues.includes('CSS_API') || issues.includes('CSS_VARS') || issues.includes('CSS_WHERE') || issues.includes('CSS_LAYER') || issues.includes('AVIF')
}

/**
 * Recommended minimum versions displayed to the user.
 */
export const RECOMMENDED_BROWSERS =
  'Chrome 99+ / Firefox 97+ / Safari 16.0+ / Edge 99+'

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
    if(!CSS.supports('selector(:where(*))'))i.push('CSS_WHERE')
  }catch(e){i.push('CSS_API')}
}
if(typeof Promise==='undefined')i.push('PROMISE');
if(typeof WeakSet==='undefined')i.push('WEAKSET');
if(typeof Proxy==='undefined')i.push('PROXY');
try{
  var _s=document.createElement('style');
  _s.textContent='@layer cep-probe{}';
  (document.head||document.documentElement).appendChild(_s);
  var _ok=false;
  if(_s.sheet){_ok=_s.sheet.cssRules.length>0}
  _s.remove();
  if(!_ok)i.push('CSS_LAYER')
}catch(e){i.push('CSS_LAYER')}
return i
})()`.replace(/\n\s*/g, '')
