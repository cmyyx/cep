import { type Page } from '@playwright/test'

/**
 * Wait for the AppInitOverlay loading screen to finish and unmount.
 *
 * The overlay blocks all interaction with the page for ~3.5 seconds
 * (1.2s initial animation + 0.8s data loading + 0.5s ready delay + 0.45s exit).
 * Tests that need to interact with sidebar or page content must call this
 * after page.goto() and before any element lookups.
 */
export async function waitForAppReady(page: Page) {
  const overlay = page.getByTestId('app-init-overlay')
  try {
    await overlay.waitFor({ state: 'detached', timeout: 10_000 })
  } catch {
    // Overlay may not exist if the page doesn't have the locale layout
    // (e.g. /_not-found, /blocked). This is fine — just continue.
  }
}
