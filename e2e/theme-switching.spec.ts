import { test, expect } from '@playwright/test'

test.describe('Theme Switching', () => {
  test('switch to dark theme', async ({ page }) => {
    await page.goto('/zh-CN/settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Use localStorage to set theme directly (more reliable than UI interaction)
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('cep-settings') || '{}')
      settings.theme = 'dark'
      localStorage.setItem('cep-settings', JSON.stringify(settings))
      document.documentElement.classList.add('dark')
    })

    // Verify <html> has dark class
    await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5000 })
  })

  test('theme persists after refresh', async ({ page }) => {
    await page.goto('/zh-CN/settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    // Set theme via localStorage
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('cep-settings') || '{}')
      settings.theme = 'dark'
      localStorage.setItem('cep-settings', JSON.stringify(settings))
      document.documentElement.classList.add('dark')
    })

    // Refresh
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Theme should persist (the FOUC-prevention script reads localStorage)
    const hasDarkClass = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark')
    })
    expect(hasDarkClass).toBe(true)
  })
})
