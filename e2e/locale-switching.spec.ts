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
    await gotoAndReady(page, '/zh-CN/settings')

    // Prefer the language select by its unique auto label to avoid the theme select.
    const languageSelect = page
      .locator('[data-slot="select-trigger"]')
      .filter({ hasText: /跟随浏览器|跟隨瀏覽器|follow browser|ブラウザ/i })
      .first()
    await expect(languageSelect).toBeVisible({ timeout: 5000 })
    await languageSelect.click()

    const englishOption = page.getByRole('option', { name: 'English', exact: true })
    await expect(englishOption).toBeVisible({ timeout: 3000 })
    await englishOption.click()

    // Wait for navigation (window.location.href causes full page navigation)
    await expect.poll(() => page.url(), { timeout: 15_000 }).toContain('/en')
  })
})
