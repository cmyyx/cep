// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
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

  it('opens dialog when a banner visual is clicked', () => {
    const { container } = render(<PoolInfoStrip />)
    const bannerBtn = container.querySelector('button')
    expect(bannerBtn).not.toBeNull()
    fireEvent.click(bannerBtn!)
    const dialogTitle = document.querySelector('[data-slot="dialog-title"]')
    expect(dialogTitle).not.toBeNull()
    expect(dialogTitle?.textContent).toBe('「临渊望北」特许寻访')
  })

  it('expands info card when info button is clicked', () => {
    const { container } = render(<PoolInfoStrip />)
    const bannerBtn = container.querySelector('button')
    fireEvent.click(bannerBtn!)
    const infoBtn = document.querySelector('[aria-label="bannerCalendar.poolInfo"]')
    expect(infoBtn).not.toBeNull()
    fireEvent.click(infoBtn!)
    expect(document.body.textContent).toContain('bannerCalendar.poolDuration')
  })

  it('renders close button with accessible text', () => {
    const { container } = render(<PoolInfoStrip />)
    const bannerBtn = container.querySelector('button')
    fireEvent.click(bannerBtn!)
    const closeSpan = document.querySelector('span.sr-only')
    expect(closeSpan).not.toBeNull()
    expect(closeSpan?.textContent).toBe('common.close')
  })
})
