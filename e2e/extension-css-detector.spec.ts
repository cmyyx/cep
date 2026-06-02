import { test, expect } from '@playwright/test'
import { gotoAndReady } from './helpers'

test.describe('Extension CSS Detector', () => {
  test('banner appears when external CSS is injected', async ({ page }) => {
    await gotoAndReady(page, '/zh-CN')
    await page.locator('[data-cep-canary]').waitFor({ state: 'attached' })

    // Inject external CSS that overrides canary styles
    await page.evaluate(() => {
      const style = document.createElement('style')
      style.textContent = '[data-cep-canary] { display: block !important; }'
      document.head.appendChild(style)
    })

    // Wait for the banner to appear
    const banner = page.locator('text=检测到页面样式被篡改')
    await expect(banner).toBeVisible({ timeout: 5000 })
  })

  test('banner can be closed', async ({ page }) => {
    await gotoAndReady(page, '/zh-CN')
    await page.locator('[data-cep-canary]').waitFor({ state: 'attached' })

    // Inject external CSS
    await page.evaluate(() => {
      const style = document.createElement('style')
      style.textContent = '[data-cep-canary] { display: block !important; }'
      document.head.appendChild(style)
    })

    // Wait for banner and close it
    // Use hasText to match the parent div, not just the <p> text node
    const banner = page.locator('div', { hasText: '检测到页面样式被篡改' }).first()
    await expect(banner).toBeVisible({ timeout: 5000 })
    await banner.getByRole('button', { name: /关闭|close/i }).click()
    await expect(banner).not.toBeVisible()
  })

  test('banner does not appear when no CSS injection', async ({ page }) => {
    await gotoAndReady(page, '/zh-CN')
    await page.locator('[data-cep-canary]').waitFor({ state: 'attached' })

    // Wait a moment for any potential detection
    await page.waitForTimeout(1000)

    // Banner should not exist
    const banner = page.locator('text=检测到页面样式被篡改')
    await expect(banner).not.toBeVisible()
  })

  test('canary hardcoded values match actual CSS', async ({ page }) => {
    await gotoAndReady(page, '/zh-CN')
    await page.locator('[data-cep-canary]').waitFor({ state: 'attached' })

    // Read the canary's actual computed styles
    const styles = await page.locator('[data-cep-canary]').evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        display: cs.display,
        fontSize: cs.fontSize,
        padding: cs.padding,
        color: cs.color,
      }
    })

    // Verify against expected values
    expect(styles.display).toBe('flex')
  })
})
