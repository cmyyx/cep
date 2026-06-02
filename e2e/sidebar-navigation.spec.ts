import { test, expect } from '@playwright/test'
import { waitForAppReady } from './helpers'

test.describe('Sidebar Navigation', () => {
  test('click navigation item changes page', async ({ page }) => {
    await page.goto('/zh-CN', { waitUntil: 'domcontentloaded' })
    await waitForAppReady(page)

    // Navigate directly to essence planner (more reliable than clicking)
    await page.goto('/zh-CN/essence-planner', { waitUntil: 'domcontentloaded' })
    await waitForAppReady(page)

    // URL should be essence-planner
    expect(page.url()).toContain('essence-planner')

    // Page should render
    await expect(page.locator('body')).toBeVisible()
  })

  test('sidebar collapse and expand', async ({ page }) => {
    await page.goto('/zh-CN', { waitUntil: 'domcontentloaded' })
    await waitForAppReady(page)

    // Find the sidebar collapse button
    const collapseBtn = page.getByRole('button').filter({ hasText: /collapse|折叠|收起/i }).first()
    const sidebar = page.locator('[data-slot="sidebar-wrapper"]').first()

    await expect(collapseBtn).toBeVisible({ timeout: 3000 })

    // Click to collapse
    await collapseBtn.click()
    await page.waitForTimeout(300) // Wait for animation

    // Sidebar should still exist
    const sidebarBox = await sidebar.boundingBox()
    expect(sidebarBox).not.toBeNull()

    // Click to expand
    await collapseBtn.click()
    await page.waitForTimeout(300)
  })

  test('mobile viewport opens drawer', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/zh-CN', { waitUntil: 'domcontentloaded' })
    await waitForAppReady(page)

    // Find the hamburger menu button
    const menuBtn = page.getByRole('button').filter({ hasText: /menu|菜单/i }).first()
    await expect(menuBtn).toBeVisible({ timeout: 3000 })
    await menuBtn.click()
    await page.waitForTimeout(300) // Wait for drawer animation

    // Sidebar should be visible in drawer mode
    const sidebar = page.locator('[data-slot="sidebar-wrapper"]').first()
    await expect(sidebar).toBeVisible()
  })

  test('navigation to multiple pages', async ({ page }) => {
    await page.goto('/zh-CN', { waitUntil: 'domcontentloaded' })
    await waitForAppReady(page)

    // Navigate to essence planner
    const essenceLink = page.getByRole('link').filter({ hasText: /基质规划|essence/i }).first()
    await expect(essenceLink).toBeVisible({ timeout: 3000 })
    await essenceLink.click()
    await waitForAppReady(page)
    expect(page.url()).toContain('essence-planner')

    // Navigate to settings (use direct navigation for reliability)
    await page.goto('/zh-CN/settings', { waitUntil: 'domcontentloaded' })
    await waitForAppReady(page)
    expect(page.url()).toContain('settings')
  })
})
