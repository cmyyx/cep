// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PlannerWikiPreview } from './planner-wiki-preview'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key === 'wiki.viewWiki' ? 'View Wiki' : key,
}))

vi.mock('@/components/shared/nav-link', () => ({
  NavLink: ({ children, href, className }: React.ComponentProps<'a'> & { loadingLabel?: string }) => <a href={href} className={className}>{children}</a>,
}))

afterEach(cleanup)

it('renders preview rows and a Wiki link for a synced entity', () => {
  render(
    <PlannerWikiPreview
      title="Test weapon"
      imageSrc="/images/weapon/test.avif"
      rarity={6}
      rows={[{ label: 'Strength', value: 'Lv.1' }]}
      wikiHref="/en/wiki/weapons/test"
    />
  )

  expect(screen.getByText('Strength')).toBeTruthy()
  expect(screen.getByText('Lv.1')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'View Wiki' }).getAttribute('href')).toBe('/en/wiki/weapons/test')
})

it('omits the Wiki link when no generated entry exists', () => {
  render(<PlannerWikiPreview title="Custom" rarity={6} rows={[]} />)
  expect(screen.queryByRole('link')).toBeNull()
})
