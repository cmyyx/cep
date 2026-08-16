import { type Page, expect } from '@playwright/test'

/**
 * Current build commit, fetched once from the served /version.json.
 *
 * E2E contexts are fresh (no localStorage), which makes the app treat them
 * as first-time visitors: the "本次更新内容" notice (B2 fallback) pops up on
 * the first load and — being a fixed bottom-right overlay with a higher
 * z-index than dropdown popups — can cover interactive elements (e.g. the
 * settings language select's options). Seeding the last-seen commit makes
 * every E2E run behave like a returning user: the notice never appears.
 */
let commitPromise: Promise<string | null> | null = null

function getBuildCommit(): Promise<string | null> {
  commitPromise ??= fetch('http://localhost:3000/version.json')
    .then((res) => (res.ok ? (res.json() as Promise<{ commit?: unknown }>) : null))
    .then((data) => (typeof data?.commit === 'string' ? data.commit : null))
    .catch(() => null)
  return commitPromise
}
/**
 * Navigate to a locale page and wait for it to be fully interactive.
 *
 * Uses 'domcontentloaded' (not 'load') because external analytics scripts
 * may never load in the test environment, preventing the 'load' event.
 * Then waits for the AppInitOverlay to finish and sidebar to be ready.
 */
export async function gotoAndReady(page: Page, url: string) {
  // Seed the notice's last-seen marker before any page script runs, so the
  // update-changelog notice never appears in E2E (see getBuildCommit).
  const commit = await getBuildCommit()
  if (commit) {
    await page.addInitScript((c) => {
      try {
        window.localStorage.setItem('cep-last-seen-commit', c)
      } catch {
        // ignore — worst case the notice shows and tests still dismiss it
      }
    }, commit)
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  // Wait for the overlay to detach (animation + unmount).
  // Only wait if the overlay actually exists; otherwise skip.
  // Let waitFor timeouts propagate — they indicate a genuine init failure.
  const overlay = page.getByTestId('app-init-overlay')
  if (await overlay.count() > 0) {
    await overlay.waitFor({ state: 'detached', timeout: 15_000 })
  }
  // Wait for the sidebar to be visible (confirms React hydration complete)
  const sidebarWrapper = page.locator('[data-slot="sidebar-wrapper"]').first()
  if (await sidebarWrapper.count() > 0) {
    await expect(sidebarWrapper).toBeVisible({ timeout: 10_000 })
  }
}
