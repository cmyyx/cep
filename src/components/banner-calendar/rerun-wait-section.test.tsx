// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useBannerStore } from '@/stores/useBannerStore'
import type { RerunWaitStat, TimelineData } from '@/types/banner'
import { RerunWaitSection } from './rerun-wait-section'

// Keeps the params visible in the rendered text so the hover-card assertions
// can check the values the component actually passed in.
const mockT = (key: string, params?: Record<string, string | number>) =>
  params
    ? `${key}(${Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')})`
    : key
vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

const EMPTY_TIMELINE: TimelineData = {
  charRows: [], months: [], canvasW: 0, rStartMs: 0, rEndMs: 0, totalDays: 0,
  pxPerDay: 1, todayPx: null, showToday: false, nowMs: 0,
  standardChars: [], rerunWaitStats: [],
}

const FIXTURE_STATS: RerunWaitStat[] = [
  { name: '提弗洛斯', days: 8, lastEndLabel: '2026/10/2', lastVersion: '1.4「」' },
  { name: '卡缪', days: 84, lastEndLabel: '2026/7/18', lastVersion: '1.3「拳出无悔」' },
  { name: '洛茜', days: 176, lastEndLabel: '2026/4/17', lastVersion: '1.1「新潮起，故渊离」下半' },
  { name: '汤汤', days: 195, lastEndLabel: '2026/3/29', lastVersion: '1.1「新潮起，故渊离」上半' },
]

function renderSection(stats: RerunWaitStat[] = FIXTURE_STATS) {
  useBannerStore.setState({ timelineData: { ...EMPTY_TIMELINE, rerunWaitStats: stats } })
  const { container } = render(<RerunWaitSection />)
  const tooltip = container.querySelector<HTMLElement>('[data-slot="rerun-wait-tooltip"]')!
  const list = container.querySelector<HTMLElement>('[data-slot="rerun-wait-list"]')!
  return { container, tooltip, list }
}

beforeEach(() => {
  useBannerStore.setState({ timelineData: null, rerunWaitOrder: 'asc' })
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
    renderSection()
    expect(screen.getByText('bannerCalendar.rerunWaitTitle')).toBeTruthy()
    expect(screen.getByText('bannerCalendar.rerunWaitSubtitle')).toBeTruthy()
    for (const s of FIXTURE_STATS) {
      expect(screen.getAllByText(s.name)).toHaveLength(1)
      expect(screen.getAllByText(String(s.days))).toHaveLength(1)
    }
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
  })

  it('keeps the bar fill readable on the dark canvas', () => {
    const { container } = renderSection()
    const bars = container.querySelectorAll<HTMLElement>('[data-slot="rerun-wait-list"] .h-5')
    expect(bars).toHaveLength(FIXTURE_STATS.length)
    for (const bar of bars) {
      expect(bar.className).toContain('bg-foreground/85')
      expect(bar.className).toContain('dark:bg-foreground/25')
    }
  })

  it('ranks every row TOP1..TOP N, longest wait first', () => {
    renderSection()
    const expected = ['汤汤', '洛茜', '卡缪', '提弗洛斯']

    expected.forEach((name, i) => {
      const rank = i + 1
      expect(screen.getByText(name).getAttribute('data-rank')).toBe(String(rank))
      // The badge spells the rank out next to the name, on every row.
      expect(screen.getByText(`bannerCalendar.rerunWaitRankBadge(rank=${rank})`)).toBeTruthy()
    })
    expect(screen.getAllByText(/rerunWaitRankBadge/)).toHaveLength(FIXTURE_STATS.length)

    // Only the top three names are colored, each with its own dark shade.
    const top3 = expected.slice(0, 3).map((name) => screen.getByText(name))
    for (const el of top3) {
      expect(el.className).toContain('font-semibold')
      expect(el.className).toContain('dark:text-')
    }
    expect(new Set(top3.map((el) => el.className)).size).toBe(3)
  })

  it('tints badges 1-3 and leaves rank 4+ in the plain muted surface', () => {
    renderSection()
    // Badges come back in list order (ascending days): ranks 4, 3, 2, 1.
    const [rank4, rank3, rank2, rank1] = screen.getAllByText(/rerunWaitRankBadge/)

    expect(rank4.className).toContain('bg-muted')
    expect(rank3.className).toContain('bg-orange-500/15')
    expect(rank2.className).toContain('bg-zinc-500/15')
    expect(rank1.className).toContain('bg-amber-500/15')
    for (const badge of [rank3, rank2, rank1]) {
      expect(badge.className).toContain('dark:text-')
    }
  })

  it('gives every row the same centered badge slot so all bars share one baseline', () => {
    const { container } = renderSection()
    const rows = Array.from(container.querySelectorAll('[data-slot="rerun-wait-list"] > div'))
    const slots = rows.map((row) => (row.children[1] as HTMLElement))

    for (const slot of slots) {
      expect(slot.className).toContain('w-11')
      // flex + items-center keeps the badge vertically centered on the name.
      expect(slot.className).toContain('flex')
      expect(slot.className).toContain('items-center')
      expect(slot.children).toHaveLength(1)
    }
    expect(new Set(slots.map((slot) => slot.className)).size).toBe(1)
  })

  it('toggles the row order from the header, keeping each rank on its name', () => {
    const { container } = renderSection()
    const listNames = () =>
      Array.from(container.querySelectorAll('[data-slot="rerun-wait-list"] > div')).map(
        (row) => (row.children[0] as HTMLElement).textContent,
      )
    const ranks = () =>
      Object.fromEntries(
        Array.from(container.querySelectorAll('[data-slot="rerun-wait-list"] [data-rank]')).map((el) => [
          el.textContent,
          el.getAttribute('data-rank'),
        ]),
      )

    // Store default: shortest wait first.
    expect(listNames()).toEqual(['提弗洛斯', '卡缪', '洛茜', '汤汤'])
    const toggle = screen.getByTitle('bannerCalendar.rerunWaitSortToggle')
    expect(toggle.textContent).toContain('bannerCalendar.rerunWaitSortAsc')

    fireEvent.click(toggle)

    expect(useBannerStore.getState().rerunWaitOrder).toBe('desc')
    expect(listNames()).toEqual(['汤汤', '洛茜', '卡缪', '提弗洛斯'])
    expect(screen.getByTitle('bannerCalendar.rerunWaitSortToggle').textContent).toContain(
      'bannerCalendar.rerunWaitSortDesc',
    )
    // The rank badge belongs to the character, not to the row position.
    expect(ranks()).toEqual({ 汤汤: '1', 洛茜: '2', 卡缪: '3', 提弗洛斯: '4' })

    fireEvent.click(screen.getByTitle('bannerCalendar.rerunWaitSortToggle'))
    expect(useBannerStore.getState().rerunWaitOrder).toBe('asc')
    expect(listNames()).toEqual(['提弗洛斯', '卡缪', '洛茜', '汤汤'])
  })

  it('follows the pointer with a hover card carrying the ended date, version and days', () => {
    const { tooltip, list } = renderSection()
    expect(tooltip.style.display).toBe('none')

    fireEvent.mouseMove(screen.getByText('汤汤'), { clientX: 120, clientY: 300 })
    expect(tooltip.style.display).toBe('block')
    expect(tooltip.style.left).toBe('134px')
    expect(tooltip.style.top).toBe('252px')
    expect(tooltip.textContent).toContain('汤汤')
    expect(tooltip.textContent).toContain('bannerCalendar.rerunWaitTooltipDays(days=195)')
    expect(tooltip.textContent).toContain('bannerCalendar.rerunWaitTooltipEnded(date=2026/3/29)')
    expect(tooltip.textContent).toContain('1.1「新潮起，故渊离」上半')

    // Moving onto another row swaps the content.
    fireEvent.mouseMove(screen.getByText('卡缪'), { clientX: 40, clientY: 100 })
    expect(tooltip.textContent).toContain('卡缪')
    expect(tooltip.textContent).toContain('bannerCalendar.rerunWaitTooltipDays(days=84)')
    expect(tooltip.textContent).not.toContain('汤汤')

    // Leaving the list hides it again.
    fireEvent.mouseLeave(list)
    expect(tooltip.style.display).toBe('none')
  })

  it('hides the version line when the schedule carries no label', () => {
    const { tooltip } = renderSection([{ name: '汤汤', days: 195, lastEndLabel: '2026/3/29', lastVersion: '' }])

    fireEvent.mouseMove(screen.getByText('汤汤'), { clientX: 10, clientY: 10 })
    const versionLine = tooltip.lastElementChild as HTMLElement
    expect(versionLine.textContent).toBe('')
    expect(versionLine.style.display).toBe('none')
  })
})
