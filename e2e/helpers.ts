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
  // Wait for the overlay to detach (animation + unmount)
  const overlay = page.getByTestId('app-init-overlay')
  try {
    await overlay.waitFor({ state: 'detached', timeout: 15_000 })
  } catch {
    // Overlay may not exist on pages without locale layout
  }
  // Wait for the sidebar to be visible (confirms React hydration complete)
  try {
    await expect(
      page.locator('[data-slot="sidebar-wrapper"]').first()
    ).toBeVisible({ timeout: 10_000 })
  } catch {
    // Page may not have sidebar (e.g. /_not-found)
  }
}
