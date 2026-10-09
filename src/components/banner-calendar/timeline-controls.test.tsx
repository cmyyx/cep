// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, fireEvent, screen } from '@testing-library/react'
import { useBannerStore } from '@/stores/useBannerStore'
import { TimelineControls } from './timeline-controls'

const mockT = (key: string) => key

// Radix Slider observes its size; jsdom provides no ResizeObserver.
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
  useBannerStore.setState({
    zoom: 5,
    fullOverview: false,
    showPreviewAxis: true,
    showEndedChars: true,
    sortMode: 'default',
    timelineData: null,
    needsFit: true,
    upCharacterNames: [],
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderControls(onRefresh: () => void = () => {}) {
  return render(<TimelineControls t={mockT} onRefresh={onRefresh} onFit={() => {}} />)
}

describe('TimelineControls', () => {
  it('renders the ended-characters toggle in active state by default', () => {
    renderControls()
    const btn = screen.getByTitle('bannerCalendar.endedCharsTitle')
    expect(btn.className).toContain('bg-accent')
    expect(screen.getByText('bannerCalendar.endedCharsTitle')).toBeTruthy()
  })

  it('clicking the toggle flips showEndedChars, refreshes the timeline and drops the active state', () => {
    const onRefresh = vi.fn()
    renderControls(onRefresh)
    fireEvent.click(screen.getByTitle('bannerCalendar.endedCharsTitle'))
    expect(useBannerStore.getState().showEndedChars).toBe(false)
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByTitle('bannerCalendar.endedCharsTitle').className).not.toContain('bg-accent')
  })

  it('clicking the toggle again restores visibility and refreshes again', () => {
    const onRefresh = vi.fn()
    renderControls(onRefresh)
    fireEvent.click(screen.getByTitle('bannerCalendar.endedCharsTitle'))
    fireEvent.click(screen.getByTitle('bannerCalendar.endedCharsTitle'))
    expect(useBannerStore.getState().showEndedChars).toBe(true)
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })
})
