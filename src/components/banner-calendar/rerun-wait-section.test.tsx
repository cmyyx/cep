// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useBannerStore } from '@/stores/useBannerStore'
import type { TimelineData } from '@/types/banner'
import { RerunWaitSection } from './rerun-wait-section'

const mockT = (key: string) => key
vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

const EMPTY_TIMELINE: TimelineData = {
  charRows: [], months: [], canvasW: 0, rStartMs: 0, rEndMs: 0, totalDays: 0,
  pxPerDay: 1, todayPx: null, showToday: false, nowMs: 0,
  standardChars: [], rerunWaitStats: [],
}

const FIXTURE_STATS = [
  { name: '提弗洛斯', days: 8 },
  { name: '卡缪', days: 84 },
  { name: '莱万汀', days: 243 },
]

beforeEach(() => {
  useBannerStore.setState({ timelineData: null })
})

afterEach(() => {
  cleanup()
})

describe('RerunWaitSection', () => {
  it('renders nothing without timeline data', () => {
    const { container } = render(<RerunWaitSection />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no character qualifies', () => {
    useBannerStore.setState({ timelineData: EMPTY_TIMELINE })
    const { container } = render(<RerunWaitSection />)
    expect(container.firstChild).toBeNull()
  })

  it('renders every stat as a labeled bar row', () => {
    useBannerStore.setState({
      timelineData: { ...EMPTY_TIMELINE, rerunWaitStats: FIXTURE_STATS },
    })
    render(<RerunWaitSection />)
    expect(screen.getByText('bannerCalendar.rerunWaitTitle')).toBeTruthy()
    expect(screen.getByText('bannerCalendar.rerunWaitSubtitle')).toBeTruthy()
    for (const s of FIXTURE_STATS) {
      expect(screen.getAllByText(s.name)).toHaveLength(1)
      expect(screen.getAllByText(String(s.days))).toHaveLength(1)
    }
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
  })
})
