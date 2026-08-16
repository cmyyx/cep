// @vitest-environment jsdom

import { beforeEach, expect, it, vi } from 'vitest'
import { JS_RESOURCE_GUARD_CODE } from './js-resource-guard'

/**
 * Executes the inline guard code in jsdom and drives it through the
 * real event flow (element-level script error → window load → audit).
 */
function runGuard(): void {
  // The guard is an IIFE; execute it as-is.
  const fn = new Function(JS_RESOURCE_GUARD_CODE)
  fn()
}

// jsdom shares one document across tests in this file; guard instances from
// earlier tests keep their document/window listeners, so scrub everything the
// current test can own: the overlay, the hydration sentinel and stale retry
// script tags. (Old instances are inert after their audit ran once.)
beforeEach(() => {
  document.getElementById('cep-js-fatal')?.remove()
  document.documentElement.removeAttribute('data-cep-hydrated')
  sessionStorage.clear()
  document.querySelectorAll('script[src*="_r="]').forEach((script) => script.remove())
})

function failScript(src: string): void {
  const el = document.createElement('script')
  el.src = src
  // Attach to the document so the event path reaches the guard's capture
  // listener (real <script async> tags are always in the DOM).
  document.body.appendChild(el)
  // Dispatch on the element: capture-phase listener on document receives it.
  el.dispatchEvent(new Event('error'))
  el.remove()
}

function fireLoad(): void {
  window.dispatchEvent(new Event('load'))
}

async function flushAudit(): Promise<void> {
  // audit runs inside a double requestAnimationFrame
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function setPathname(pathname: string): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname, reload: vi.fn() },
    configurable: true,
    writable: true,
  })
}

it('auto-retries the failed chunk once; the error page appears only if it still fails', async () => {
  vi.useFakeTimers()
  try {
    setPathname('/zh-CN/essence-planner')
    sessionStorage.removeItem('cep-js-retried')

    runGuard()
    failScript('/_next/static/chunks/fail-abc123.js')
    fireLoad()
    // Two rAFs drive the audit; then the auto-retry re-inserts the script.
    vi.advanceTimersByTime(100)

    expect(document.getElementById('cep-js-fatal')).toBeNull()
    expect(document.querySelectorAll('script[src*="_r="]').length).toBe(1)
    expect(sessionStorage.getItem('cep-js-retried')).toBe('1')

    // Retry outcome: the re-inserted script also fails (browser fires an
    // element error on the _r= URL) — but the guard must NOT record the
    // retry URL, so the fallback lists the original resource exactly once.
    const retried = document.querySelector('script[src*="_r="]') as HTMLScriptElement
    expect(retried).not.toBeNull()
    retried.dispatchEvent(new Event('error'))
    vi.advanceTimersByTime(6000)

    const overlay = document.getElementById('cep-js-fatal')
    expect(overlay).not.toBeNull()
    const occurrences = overlay!.innerHTML.split('/_next/static/chunks/fail-abc123.js').length - 1
    expect(occurrences).toBe(1)
    expect(overlay!.innerHTML).not.toContain('_r=')
  } finally {
    vi.useRealTimers()
  }
})

it('auto-retry succeeds (script loads) → no error page', async () => {
  vi.useFakeTimers()
  try {
    setPathname('/zh-CN/essence-planner')
    sessionStorage.removeItem('cep-js-retried')

    runGuard()
    failScript('/_next/static/chunks/fail-ok456.js')
    fireLoad()
    vi.advanceTimersByTime(100)

    // Simulate the retried script loading successfully.
    const retried = document.querySelector('script[src*="_r="]') as HTMLScriptElement
    retried.dispatchEvent(new Event('load'))

    // Hydration completes after the chunk loads.
    document.documentElement.setAttribute('data-cep-hydrated', '1')
    vi.advanceTimersByTime(6000)

    expect(document.getElementById('cep-js-fatal')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

it('shows the localized fallback with failing URLs after the auto-retry was spent', async () => {
  setPathname('/ja/growth-planner')
  sessionStorage.setItem('cep-js-retried', '1')

  runGuard()
  failScript('/_next/static/chunks/fail-def456.js')
  fireLoad()
  await flushAudit()

  const overlay = document.getElementById('cep-js-fatal')
  expect(overlay).not.toBeNull()
  expect(overlay!.innerHTML).toContain('/_next/static/chunks/fail-def456.js')
  // ja copy is embedded (unicode escapes in the code become real chars at runtime)
  expect(overlay!.innerHTML).toContain('再読み込み')
  // Feedback block is single-language (ja), not the bilingual fallback.
  expect(overlay!.innerHTML).toContain('フィードバック')
  expect(overlay!.innerHTML).not.toContain('Having issues?')
  // The environment-info code block must NOT leak into the overlay.
  expect(overlay!.innerHTML).not.toContain('navigator.userAgent')
  expect(overlay!.querySelector('#cep-js-fatal-retry')).not.toBeNull()
  expect(overlay!.querySelector('#cep-js-fatal-reload')).not.toBeNull()
})

it('reload button clears both guard keys and triggers a page reload', async () => {
  setPathname('/en/wiki/weapons')
  sessionStorage.setItem('cep-js-retried', '1')
  sessionStorage.setItem('cep-chunk-reload-once', '1')
  const reload = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname: '/en/wiki/weapons', reload },
    configurable: true,
    writable: true,
  })

  runGuard()
  failScript('/_next/static/chunks/fail-ghi789.js')
  fireLoad()
  await flushAudit()

  const reloadBtn = document.getElementById('cep-js-fatal-reload') as HTMLButtonElement
  expect(reloadBtn).not.toBeNull()
  reloadBtn.click()
  expect(reload).toHaveBeenCalledTimes(1)
  expect(sessionStorage.getItem('cep-js-retried')).toBeNull()
  expect(sessionStorage.getItem('cep-chunk-reload-once')).toBeNull()
})

it('retry re-inserts the failed scripts with a cache-buster', async () => {
  setPathname('/zh-CN/essence-planner')
  sessionStorage.setItem('cep-js-retried', '1')

  runGuard()
  failScript('/_next/static/chunks/fail-jkl012.js')
  fireLoad()
  await flushAudit()

  const scriptsBefore = document.querySelectorAll('script[src*="_r="]').length
  const retryBtn = document.getElementById('cep-js-fatal-retry') as HTMLButtonElement
  retryBtn.click()
  expect(document.querySelectorAll('script[src*="_r="]').length).toBe(scriptsBefore + 1)
})

it('shows nothing outside a locale route (404 page owns its surface)', async () => {
  setPathname('/404.html')
  sessionStorage.setItem('cep-js-retried', '1')

  runGuard()
  failScript('/_next/static/chunks/fail-mno345.js')
  fireLoad()
  await flushAudit()

  expect(document.getElementById('cep-js-fatal')).toBeNull()
})

it('only warns when hydration already succeeded (non-critical failure)', async () => {
  setPathname('/zh-CN/essence-planner')
  sessionStorage.setItem('cep-chunk-reload-once', '1')
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  document.documentElement.setAttribute('data-cep-hydrated', '1')

  runGuard()
  failScript('/_next/static/chunks/fail-pqr678.js')
  fireLoad()
  await flushAudit()

  expect(document.getElementById('cep-js-fatal')).toBeNull()
  expect(warn).toHaveBeenCalled()
  document.documentElement.removeAttribute('data-cep-hydrated')
  warn.mockRestore()
})
