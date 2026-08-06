// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DonationSection } from '@/components/about/donation-section'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/image', () => ({
  default: ({ alt = '' }: { alt?: string }) => <span role="img" aria-label={alt} />,
}))

vi.mock('@/lib/donors', () => ({
  donors: [
    { name: '甲', amount: 66.66, date: '2026-07-01', message: '加油' },
    { name: '乙', amount: 5.0, date: '2026-08-04', message: '' },
    { name: '丙', amount: 3.0, message: '支持' },
  ],
}))

afterEach(cleanup)

it('renders the donor list expanded by default with dates and amounts', () => {
  render(<DonationSection />)
  // 默认展开: 无需点击即可看到名单条目
  expect(screen.getByText('甲')).toBeTruthy()
  expect(screen.getByText('乙')).toBeTruthy()
  // 日期显示在金额下方
  expect(screen.getByText('2026-07-01')).toBeTruthy()
  expect(screen.getByText('2026-08-04')).toBeTruthy()
  // 按金额降序 + 金额格式化
  expect(screen.getByText('¥66.66')).toBeTruthy()
})

it('collapses and expands the list via the toggle', () => {
  render(<DonationSection />)
  const toggle = screen.getByRole('button', { name: 'about.donationListTitle' })
  fireEvent.click(toggle)
  expect(screen.queryByText('甲')).toBeNull()
  fireEvent.click(toggle)
  expect(screen.getByText('甲')).toBeTruthy()
})
