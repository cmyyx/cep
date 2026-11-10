// @vitest-environment jsdom

import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { JS_RESOURCE_GUARD_CODE } from './js-resource-guard'

/**
 * Executes the inline guard code in jsdom and drives it through the
 * real event flow (element-level script error → window load → audit).
 * The guard IIFE returns a cleanup function (removes the capture-phase
 * error listener and stops the poll timer); tests call it in afterEach.
 */
let guardCleanup: (() => void) | null = null
let fetchMock: ReturnType<typeof vi.fn>

/**
 * 守卫内部会排多个定时器（15s 挂起看门狗、自愈的 10s 修复超时、1s 轮询），
 * 而它返回的 cleanup 只清掉自己记着的 id：先 cleanup 后落定的 fetch 回调还会
 * 再排一轮，于是漏掉的定时器在 jsdom 拆掉之后才触发，抛
 * `ReferenceError: document is not defined`。vitest 把它算作 unhandled error，
 * 整个 test run 直接失败（CI 就这样红过一次）。
 * 下面登记所有定时器 id，afterEach 与 afterAll 统一清空。
 */

/** 未被登记的原始 setTimeout：afterAll 里只是等一拍，不应再被记录成待清理定时器。 */
const realSetTimeoutShim = globalThis.setTimeout.bind(globalThis)

const scheduledTimers = new Set<unknown>()

function clearScheduledTimers(): void {
  for (const id of scheduledTimers) {
    clearTimeout(id as never)
    clearInterval(id as never)
  }
  scheduledTimers.clear()
}

function trackTimers(): void {
  const realSetTimeout = globalThis.setTimeout.bind(globalThis)
  const realSetInterval = globalThis.setInterval.bind(globalThis)
  const trackedSetTimeout = ((handler: TimerHandler, ms?: number, ...args: unknown[]) => {
    const id = realSetTimeout(handler as never, ms, ...(args as never[]))
    scheduledTimers.add(id)
    return id
  }) as unknown as typeof setTimeout
  const trackedSetInterval = ((handler: TimerHandler, ms?: number, ...args: unknown[]) => {
    const id = realSetInterval(handler as never, ms, ...(args as never[]))
    scheduledTimers.add(id)
    return id
  }) as unknown as typeof setInterval
  vi.stubGlobal('setTimeout', trackedSetTimeout)
  vi.stubGlobal('setInterval', trackedSetInterval)
}

function runGuard(): void {
  // The guard is an IIFE; execute it as-is. new Function is required here:
  // the guard is served as an inline string and must be executable verbatim.
  const fn = new Function(JS_RESOURCE_GUARD_CODE)
  guardCleanup = fn() as () => void
}

// jsdom shares one document across tests in this file; guard instances from
// earlier tests keep their document/window listeners, so scrub everything the
// current test can own: the overlay and the hydration sentinel. The guard's own
// cleanup (error listener + poll timer) runs via the cleanup function returned
// by runGuard.
beforeEach(() => {
  trackTimers()
  document.getElementById('cep-js-fatal')?.remove()
  document.documentElement.removeAttribute('data-cep-hydrated')
  sessionStorage.clear()
  // The self-heal path calls fetch(url, {cache:'reload'}); no test may reach the
  // network. The default mock answers with a healthy response so the guard
  // reloads; tests override it to make the repair fail.
  fetchMock = vi.fn(() => Promise.resolve({ ok: true }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  guardCleanup?.()
  guardCleanup = null
  clearScheduledTimers()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// 兜底：cleanup 之后才落定的 fetch 回调还会再排一轮定时器（微任务在本用例的
// afterEach 跑完后才执行），必须等微任务清空再补一次清理，否则它们会活到 jsdom
// 拆掉之后，最后以 `document is not defined` 变成 unhandled error。
afterAll(async () => {
  for (let round = 0; round < 3; round += 1) {
    await Promise.resolve()
    await new Promise((resolve) => realSetTimeoutShim(resolve, 0))
    clearScheduledTimers()
  }
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

function failLink(href: string): void {
  const el = document.createElement('link')
  el.rel = 'stylesheet'
  el.href = href
  // Same path as failScript: the element must be in the document for the
  // capture-phase listener on document to see its error event.
  document.body.appendChild(el)
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

/** Let the repair fetch promises settle (the mocked fetch resolves at once). */
function flushRepair(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Element URLs are resolved against document.baseURI before the guard sees
 * them (t.src/t.href), exactly like a real browser — assert the absolute form.
 */
function resolved(path: string): string {
  return new URL(path, document.baseURI).href
}

function setPathname(pathname: string): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname, reload: vi.fn() },
    configurable: true,
    writable: true,
  })
}

/** Install a location whose reload is an observable spy (one per test). */
function setReloadableLocation(pathname: string, reload: () => void): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname, reload },
    configurable: true,
    writable: true,
  })
}

it('re-fetches the failed resources with cache:reload and reloads the page once', async () => {
  const reload = vi.fn()
  setReloadableLocation('/zh-CN/essence-planner', reload)

  runGuard()
  failScript('/_next/static/chunks/fail-abc123.js')
  failLink('/_next/static/css/fail-css456.css')
  fireLoad()
  await flushAudit()
  await flushRepair()

  // A 404 cached with a long max-age never resolves on its own, so the guard has
  // to overwrite the stored response instead of re-inserting a cache-busted URL.
  expect(fetchMock).toHaveBeenCalledWith(resolved('/_next/static/chunks/fail-abc123.js'), {
    cache: 'reload',
  })
  expect(fetchMock).toHaveBeenCalledWith(resolved('/_next/static/css/fail-css456.css'), {
    cache: 'reload',
  })
  expect(reload).toHaveBeenCalledTimes(1)
  // The budget is spent for this tab; a page that hydrates later re-arms it.
  expect(sessionStorage.getItem('cep-js-retried')).toBe('1')
  expect(document.getElementById('cep-js-fatal')).toBeNull()
})

it('shows the error page without reloading when the resources cannot be re-fetched', async () => {
  const reload = vi.fn()
  setReloadableLocation('/zh-CN/essence-planner', reload)
  fetchMock.mockImplementation(() => Promise.resolve({ ok: false }))

  runGuard()
  failScript('/_next/static/chunks/fail-def456.js')
  fireLoad()
  await flushAudit()
  await flushRepair()

  expect(reload).not.toHaveBeenCalled()
  const overlay = document.getElementById('cep-js-fatal')
  expect(overlay).not.toBeNull()
  expect(overlay!.innerHTML).toContain('/_next/static/chunks/fail-def456.js')
})

it('falls back to the localized error page when the repair budget was already spent', async () => {
  const reload = vi.fn()
  setReloadableLocation('/ja/growth-planner', reload)
  sessionStorage.setItem('cep-js-retried', '1')

  runGuard()
  failScript('/_next/static/chunks/fail-ghi789.js')
  fireLoad()
  await flushAudit()
  await flushRepair()

  // No second automatic reload: the guard must never loop on a broken deploy.
  expect(reload).not.toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()

  const overlay = document.getElementById('cep-js-fatal')
  expect(overlay).not.toBeNull()
  expect(overlay!.innerHTML).toContain('/_next/static/chunks/fail-ghi789.js')
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

it('repairs the cache and drops the overlay once the page hydrates, re-arming the budget', async () => {
  vi.useFakeTimers()
  try {
    setPathname('/zh-CN/essence-planner')
    sessionStorage.setItem('cep-js-retried', '1')

    runGuard()
    failScript('/_next/static/chunks/fail-jkl012.js')
    fireLoad()
    vi.advanceTimersByTime(100)
    expect(document.getElementById('cep-js-fatal')).not.toBeNull()

    document.documentElement.setAttribute('data-cep-hydrated', '1')
    vi.advanceTimersByTime(1000)

    expect(document.getElementById('cep-js-fatal')).toBeNull()
    expect(sessionStorage.getItem('cep-js-retried')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

it('retry button repairs the cache entries and reloads the page', async () => {
  const reload = vi.fn()
  setReloadableLocation('/en/wiki/weapons', reload)
  sessionStorage.setItem('cep-js-retried', '1')

  runGuard()
  failScript('/_next/static/chunks/fail-mno345.js')
  fireLoad()
  await flushAudit()

  const retryBtn = document.getElementById('cep-js-fatal-retry') as HTMLButtonElement
  expect(retryBtn).not.toBeNull()
  retryBtn.click()
  await flushRepair()

  expect(fetchMock).toHaveBeenCalledWith(resolved('/_next/static/chunks/fail-mno345.js'), {
    cache: 'reload',
  })
  expect(reload).toHaveBeenCalledTimes(1)
})

it('reload button clears both guard budgets and triggers a page reload', async () => {
  sessionStorage.setItem('cep-js-retried', '1')
  sessionStorage.setItem('cep-chunk-reload-once', '1')
  const reload = vi.fn()
  setReloadableLocation('/en/wiki/weapons', reload)

  runGuard()
  failScript('/_next/static/chunks/fail-pqr678.js')
  fireLoad()
  await flushAudit()

  const reloadBtn = document.getElementById('cep-js-fatal-reload') as HTMLButtonElement
  expect(reloadBtn).not.toBeNull()
  reloadBtn.click()
  expect(reload).toHaveBeenCalledTimes(1)
  expect(sessionStorage.getItem('cep-js-retried')).toBeNull()
  expect(sessionStorage.getItem('cep-chunk-reload-once')).toBeNull()
})

it('shows nothing outside a locale route (404 page owns its surface)', async () => {
  setPathname('/404.html')
  sessionStorage.setItem('cep-js-retried', '1')

  runGuard()
  failScript('/_next/static/chunks/fail-stu901.js')
  fireLoad()
  await flushAudit()
  await flushRepair()

  expect(fetchMock).not.toHaveBeenCalled()
  expect(document.getElementById('cep-js-fatal')).toBeNull()
})

it('warns and silently repairs (no reload, no overlay) when hydration already succeeded', async () => {
  const reload = vi.fn()
  setReloadableLocation('/zh-CN/essence-planner', reload)
  sessionStorage.setItem('cep-chunk-reload-once', '1')
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  document.documentElement.setAttribute('data-cep-hydrated', '1')

  runGuard()
  failScript('/_next/static/chunks/fail-vwx234.js')
  fireLoad()
  await flushAudit()
  await flushRepair()

  // 页面可用:不弹错误页、不打断用户,只把中毒的缓存条目换掉。
  expect(document.getElementById('cep-js-fatal')).toBeNull()
  expect(reload).not.toHaveBeenCalled()
  expect(fetchMock).toHaveBeenCalledWith(resolved('/_next/static/chunks/fail-vwx234.js'), {
    cache: 'reload',
  })
  expect(warn).toHaveBeenCalled()
  document.documentElement.removeAttribute('data-cep-hydrated')
  warn.mockRestore()
})
