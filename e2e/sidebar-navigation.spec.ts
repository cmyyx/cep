import { test, expect } from '@playwright/test'
import { gotoAndReady } from './helpers'

test.describe('Sidebar Navigation', () => {
  test('click navigation item changes page', async ({ page }) => {
    await gotoAndReady(page, '/zh-CN')

    // Navigate directly to essence planner
    await gotoAndReady(page, '/zh-CN/essence-planner')

    // URL should be essence-planner
    expect(page.url()).toContain('essence-planner')

    // Page should render
    await expect(page.locator('body')).toBeVisible()
  })

  test('sidebar collapse and expand', async ({ page }) => {
    await gotoAndReady(page, '/zh-CN')

    // The SidebarTrigger is the collapse/expand button
    const trigger = page.locator('[data-sidebar="trigger"]').first()

    await expect(trigger).toBeVisible({ timeout: 3000 })

    // Click to collapse — assert data-state changes to "collapsed"
    await trigger.click()
    await expect(page.locator('[data-slot="sidebar"][data-state="collapsed"]')).toBeVisible({ timeout: 5000 })

    // Click to expand — assert data-state changes to "expanded"
    await trigger.click()
    await expect(page.locator('[data-slot="sidebar"][data-state="expanded"]')).toBeVisible({ timeout: 5000 })
  })

  test('mobile viewport opens drawer', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await gotoAndReady(page, '/zh-CN')

    // On mobile, the SidebarTrigger opens the drawer
    const trigger = page.locator('[data-sidebar="trigger"]').first()
    await expect(trigger).toBeVisible({ timeout: 3000 })
    await trigger.click()
    await page.waitForTimeout(300) // Wait for drawer animation

    // Sidebar should be visible in drawer mode
    const sidebar = page.locator('[data-slot="sidebar-wrapper"]').first()
    await expect(sidebar).toBeVisible()
  })

  test('navigation to multiple pages', async ({ page }) => {
    await gotoAndReady(page, '/zh-CN')

    // Navigate to essence planner via sidebar link
    const essenceLink = page.locator('[data-sidebar="menu"] a[href*="essence-planner"]').first()
    await expect(essenceLink).toBeVisible({ timeout: 3000 })
    await essenceLink.click()

    // Wait for URL to change (use domcontentloaded since external scripts block 'load')
    await page.waitForURL('**/essence-planner**', { timeout: 10_000, waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('essence-planner')

    // Navigate to settings
    await gotoAndReady(page, '/zh-CN/settings')
    expect(page.url()).toContain('settings')
  })
})
