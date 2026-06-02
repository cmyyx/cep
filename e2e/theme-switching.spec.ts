import { test, expect } from '@playwright/test'

test.describe('Theme Switching', () => {
  test('switch to dark theme', async ({ page }) => {
    await page.goto('/zh-CN/settings', { waitUntil: 'domcontentloaded' })

    // Set theme via localStorage (app reads this on load)
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('cep-settings') || '{}')
      settings.theme = 'dark'
      localStorage.setItem('cep-settings', JSON.stringify(settings))
    })

    // Reload to let the app apply the theme from localStorage
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Wait for the dark class to be applied by the app's FOUC-prevention script
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))

    // Verify <html> has dark class
    await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5000 })
  })

  test('theme persists after refresh', async ({ page }) => {
    await page.goto('/zh-CN/settings', { waitUntil: 'domcontentloaded' })

    // Set theme via localStorage
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('cep-settings') || '{}')
      settings.theme = 'dark'
      localStorage.setItem('cep-settings', JSON.stringify(settings))
    })

    // Reload — the FOUC-prevention script should apply the dark class
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Wait for the app to apply the theme
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))

    // Theme should persist
    const hasDarkClass = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark')
    })
    expect(hasDarkClass).toBe(true)
  })
})
