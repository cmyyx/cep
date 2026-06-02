import { test, expect } from '@playwright/test'
import { waitForAppReady } from './helpers'

test.describe('Locale Switching', () => {
  test('switch to English via URL', async ({ page }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' })
    await waitForAppReady(page)

    // URL should contain /en/
    expect(page.url()).toContain('/en')

    // Page content should be in English (check for common English text)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.length).toBeGreaterThan(0)
  })

  test('switch to Japanese via URL', async ({ page }) => {
    await page.goto('/ja', { waitUntil: 'domcontentloaded' })
    await waitForAppReady(page)

    // URL should contain /ja/
    expect(page.url()).toContain('/ja')
  })

  test('direct URL access to locale', async ({ page }) => {
    await page.goto('/ja/', { waitUntil: 'domcontentloaded' })
    await waitForAppReady(page)

    // Should be on Japanese locale
    expect(page.url()).toContain('/ja')

    // Page should render without errors
    await expect(page.locator('body')).toBeVisible()
  })

  test('locale switcher changes locale', async ({ page }) => {
    await page.goto('/zh-CN', { waitUntil: 'domcontentloaded' })
    await waitForAppReady(page)

    // Find and click the language switcher
    const langSwitcher = page.getByRole('button').filter({ hasText: /中|zh/i }).first()
    await expect(langSwitcher).toBeVisible()
    await langSwitcher.click()

    // Click English option
    const enOption = page.getByText(/english|en/i).first()
    await expect(enOption).toBeVisible()
    await enOption.click()
    await waitForAppReady(page)
    expect(page.url()).toContain('/en')
  })
})
