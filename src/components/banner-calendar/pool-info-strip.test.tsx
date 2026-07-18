// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PoolInfoStrip } from './pool-info-strip'

const mockT = (key: string) => key
vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
  useLocale: () => 'zh-CN',
}))

vi.mock('@/data/banner', () => ({
  bannerEntries: [
    {
      id: '1.4-jue',
      title: '「临渊望北」特许寻访',
      subtitle: '诀',
      description: 'test description',
      imageUrl: '/images/banners/jue.webp',
      officialUrl: '',
      version: '1.4',
      periodStart: '2026-07-16T12:00:00+08:00',
      periodEnd: '2026-08-09T11:59:00+08:00',
      featured: [{ name: '诀', period: 9 }],
    },
  ],
}))

describe('PoolInfoStrip', () => {
  it('renders header text', () => {
    const { container } = render(<PoolInfoStrip />)
    expect(container.textContent).toContain('bannerCalendar.poolInfo')
  })

  it('renders banner title from entries', () => {
    const { container } = render(<PoolInfoStrip />)
    expect(container.textContent).toContain('「临渊望北」特许寻访')
  })
})
