// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  // 只保留 key，并带上插值参数，避免测试依赖真实文案。
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}#${String(values.count)}` : key,
}))
vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string) => key,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/zh-CN/wiki',
  useRouter: () => ({ push: () => {}, prefetch: () => {} }),
}))
vi.mock('@/components/ui/sidebar', () => ({ SidebarTrigger: () => <span /> }))

import WikiIndexPage from './page'
import { wikiCharacters } from '@/generated/data/wiki/characters'
import { wikiWeapons } from '@/generated/data/wiki/weapons'
import { wikiEquipment } from '@/generated/data/wiki/equipment'

afterEach(cleanup)

async function renderPage() {
  const element = await WikiIndexPage({ params: Promise.resolve({ locale: 'zh-CN' }) })
  return render(element)
}

it('links the three wiki indexes and both planners under the current locale', async () => {
  const { container } = await renderPage()
  const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'))
  expect(hrefs).toEqual([
    '/zh-CN/wiki/characters',
    '/zh-CN/wiki/weapons',
    '/zh-CN/wiki/equipment',
    '/zh-CN/essence-planner',
    '/zh-CN/refinement-planner',
  ])
})

it('prints the real record count of each index', async () => {
  await renderPage()
  expect(screen.getByText(`wiki.hub.recordCount#${wikiCharacters.length}`)).toBeTruthy()
  expect(screen.getByText(`wiki.hub.recordCount#${wikiWeapons.length}`)).toBeTruthy()
  expect(screen.getByText(`wiki.hub.recordCount#${wikiEquipment.length}`)).toBeTruthy()
})
