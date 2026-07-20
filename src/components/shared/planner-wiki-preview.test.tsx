// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PlannerWikiPreview, plainWikiPreviewValue } from './planner-wiki-preview'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key === 'wiki.viewWiki' ? 'View Wiki' : key,
}))

vi.mock('@/components/shared/nav-link', () => ({
  NavLink: ({ children, href, className }: React.ComponentProps<'a'> & { loadingLabel?: string }) => <a href={href} className={className}>{children}</a>,
}))

afterEach(cleanup)

it('extracts the first numeric value from a localized stat description', () => {
  expect(plainWikiPreviewValue('最大生命值<@ba.vup>+62.4%</>')).toBe('+62.4%')
})

it('renders preview rows and a Wiki link for a synced entity', () => {
  render(
    <PlannerWikiPreview
      title="Test weapon"
      imageSrc="/images/weapon/test.avif"
      rarity={6}
      rows={[{ label: 'Strength', levelOne: '16', maxLevel: '124' }]}
      wikiHref="/en/wiki/weapons/test"
      maxLevelLabel="Lv.9"
    />
  )

  expect(screen.getByText('Strength')).toBeTruthy()
  expect(screen.getByText('16')).toBeTruthy()
  expect(screen.getByText('124')).toBeTruthy()
  expect(screen.getByText('Lv.9')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'View Wiki' }).getAttribute('href')).toBe('/en/wiki/weapons/test')
})

it('omits the Wiki link when no generated entry exists', () => {
  render(<PlannerWikiPreview title="Custom" rarity={6} rows={[]} />)
  expect(screen.queryByRole('link')).toBeNull()
})
