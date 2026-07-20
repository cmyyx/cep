// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, fireEvent, screen } from '@testing-library/react'
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

afterEach(() => {
  cleanup()
})

describe('PoolInfoStrip', () => {
  it('renders header text', () => {
    render(<PoolInfoStrip />)
    expect(screen.getByText('bannerCalendar.poolInfo')).toBeTruthy()
  })

  it('renders banner title from entries', () => {
    render(<PoolInfoStrip />)
    expect(screen.getByRole('button', { name: /「临渊望北」特许寻访/ })).toBeTruthy()
  })

  it('opens dialog when a banner visual is clicked', () => {
    render(<PoolInfoStrip />)
    const bannerButton = screen.getByRole('button', { name: /「临渊望北」特许寻访/ })
    fireEvent.click(bannerButton)
    expect(screen.getByRole('dialog', { name: '「临渊望北」特许寻访' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '「临渊望北」特许寻访' })).toBeTruthy()
  })

  it('expands info card when info button is clicked', () => {
    render(<PoolInfoStrip />)
    const bannerButton = screen.getByRole('button', { name: /「临渊望北」特许寻访/ })
    fireEvent.click(bannerButton)
    const infoButton = screen.getByLabelText('bannerCalendar.poolInfo')
    fireEvent.click(infoButton)
    expect(screen.getByText('bannerCalendar.poolDuration:')).toBeTruthy()
  })

  it('renders close button with accessible text', () => {
    render(<PoolInfoStrip />)
    const bannerButton = screen.getByRole('button', { name: /「临渊望北」特许寻访/ })
    fireEvent.click(bannerButton)
    expect(screen.getByRole('button', { name: 'common.close' })).toBeTruthy()
  })
})
