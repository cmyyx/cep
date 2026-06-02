import { type Page, expect } from '@playwright/test'

/**
 * Navigate to a locale page and wait for it to be fully interactive.
 *
 * Uses 'domcontentloaded' (not 'load') because external analytics scripts
 * may never load in the test environment, preventing the 'load' event.
 * Then waits for the AppInitOverlay to finish and sidebar to be ready.
 */
export async function gotoAndReady(page: Page, url: string) {
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
