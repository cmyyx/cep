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
  | 'CSS_WHERE'     // :where() selector not supported (proxy for @layer)
  | 'PROMISE'       // Promise not available
  | 'WEAKSET'       // WeakSet not available
  | 'PROXY'         // Proxy not available

interface DetectScope {
  CSS?: { supports?: (cond: string) => boolean } | null
  Promise?: unknown
  WeakSet?: unknown
  Proxy?: unknown
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

  return issues
}

/**
 * Returns true if the issues list contains a deal-breaker that will prevent
 * the page from rendering at all (no CSS custom properties, no CSS API).
 */
export function isCritical(issues: BrowserIssue[]): boolean {
  return issues.includes('CSS_API') || issues.includes('CSS_VARS') || issues.includes('CSS_WHERE')
}

/**
 * Recommended minimum versions displayed to the user.
 */
export const RECOMMENDED_BROWSERS =
  'Chrome 99+ / Firefox 97+ / Safari 15.4+ / Edge 99+'

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
return i
})()`.replace(/\n\s*/g, '')
