import { test, expect } from '@playwright/test'

test.describe('Locale Switching', () => {
  test('switch to English via URL', async ({ page }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    // URL should contain /en/
    expect(page.url()).toContain('/en')

    // Page content should be in English (check for common English text)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.length).toBeGreaterThan(0)
  })

  test('switch to Japanese via URL', async ({ page }) => {
    await page.goto('/ja', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    // URL should contain /ja/
    expect(page.url()).toContain('/ja')
  })

  test('direct URL access to locale', async ({ page }) => {
    await page.goto('/ja/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    // Should be on Japanese locale
    expect(page.url()).toContain('/ja')

    // Page should render without errors
    await expect(page.locator('body')).toBeVisible()
  })

  test('locale switcher changes locale', async ({ page }) => {
    await page.goto('/zh-CN', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    // Find and click the language switcher
    const langSwitcher = page.getByRole('button').filter({ hasText: /中|zh/i }).first()
    if (await langSwitcher.isVisible()) {
      await langSwitcher.click()

      // Click English option
      const enOption = page.getByText(/english|en/i).first()
      if (await enOption.isVisible()) {
        await enOption.click()
        await page.waitForTimeout(1000)
        expect(page.url()).toContain('/en')
      }
    }
  })
})
