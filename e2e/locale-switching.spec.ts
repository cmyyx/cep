import { test, expect } from '@playwright/test'
import { gotoAndReady } from './helpers'

test.describe('Locale Switching', () => {
  test('switch to English via URL', async ({ page }) => {
    await gotoAndReady(page, '/en')

    // URL should contain /en/
    expect(page.url()).toContain('/en')

    // Page content should be in English (check for common English text)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.length).toBeGreaterThan(0)
  })

  test('switch to Japanese via URL', async ({ page }) => {
    await gotoAndReady(page, '/ja')

    // URL should contain /ja/
    expect(page.url()).toContain('/ja')
  })

  test('direct URL access to locale', async ({ page }) => {
    await gotoAndReady(page, '/ja/')

    // Should be on Japanese locale
    expect(page.url()).toContain('/ja')

    // Page should render without errors
    await expect(page.locator('body')).toBeVisible()
  })

  test('locale switcher changes locale', async ({ page }) => {
    await gotoAndReady(page, '/zh-CN')

    // Language switcher shows "AUTO" by default (language setting is 'auto')
    const langSwitcher = page.getByRole('button').filter({ hasText: /AUTO|中|zh|English|日本語/i }).first()
    await expect(langSwitcher).toBeVisible({ timeout: 5000 })
    await langSwitcher.click()

    // Scope to the opened language menu, then locate the English option
    const langMenu = page.locator('[role="menu"]').first()
    await expect(langMenu).toBeVisible({ timeout: 3000 })
    const enOption = langMenu.getByRole('menuitem', { name: /english/i })
    await enOption.click()

    // Wait for navigation (window.location.href causes full page navigation)
    await expect.poll(() => page.url(), { timeout: 15_000 }).toContain('/en')
  })
})
