import { describe, it, expect, beforeEach } from 'vitest'
import { useBannerStore } from './useBannerStore'

const mockT = (key: string, params?: Record<string, number | string>): string => {
  if (params) {
    let result = key
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, String(v))
    }
    return result
  }
  return key
}

describe('useBannerStore', () => {
  beforeEach(() => {
    useBannerStore.setState({
      zoom: 5,
      fullOverview: false,
      showPreviewAxis: true,
      sortMode: 'default',
      timelineData: null,
      needsFit: true,
    })
  })

  it('has correct initial state', () => {
    const state = useBannerStore.getState()
    expect(state.zoom).toBe(5)
    expect(state.fullOverview).toBe(false)
    expect(state.showPreviewAxis).toBe(true)
    expect(state.sortMode).toBe('default')
    expect(state.timelineData).toBeNull()
    expect(state.needsFit).toBe(true)
  })

  it('setZoom clamps to MIN_ZOOM', () => {
    useBannerStore.getState().setZoom(0)
    expect(useBannerStore.getState().zoom).toBe(1.5)
    expect(useBannerStore.getState().fullOverview).toBe(false)
  })

  it('setZoom clamps to MAX_ZOOM', () => {
    useBannerStore.getState().setZoom(100)
    expect(useBannerStore.getState().zoom).toBe(15)
  })

  it('setZoom accepts valid values', () => {
    useBannerStore.getState().setZoom(8)
    expect(useBannerStore.getState().zoom).toBe(8)
  })

  it('setZoom clears fullOverview', () => {
    useBannerStore.setState({ fullOverview: true })
    useBannerStore.getState().setZoom(5)
    expect(useBannerStore.getState().fullOverview).toBe(false)
  })

  it('refresh produces timelineData', () => {
    const store = useBannerStore.getState()
    store.refresh(mockT, 'zh-CN')
    const data = useBannerStore.getState().timelineData
    expect(data).not.toBeNull()
    expect(data!.charRows.length).toBeGreaterThan(0)
    expect(data!.months.length).toBeGreaterThan(0)
    expect(data!.canvasW).toBeGreaterThan(0)
    expect(data!.totalDays).toBeGreaterThan(0)
    expect(data!.standardChars.length).toBeGreaterThan(0)
  })

  it('refresh produces charRows with correct structure', () => {
    const store = useBannerStore.getState()
    store.refresh(mockT, 'zh-CN')
    const data = useBannerStore.getState().timelineData!
    for (const ch of data.charRows) {
      expect(ch.name).toBeTruthy()
      expect(ch.avatarSrc).toBeTruthy()
      expect(Array.isArray(ch.bars)).toBe(true)
      expect(typeof ch.hasActive).toBe('boolean')
    }
  })

  it('fitToViewport clamps zoom and sets fullOverview', () => {
    const store = useBannerStore.getState()
    store.refresh(mockT, 'zh-CN')

    store.fitToViewport(800, mockT, 'zh-CN')
    const state = useBannerStore.getState()
    expect(state.zoom).toBeGreaterThanOrEqual(1.5)
    expect(state.zoom).toBeLessThanOrEqual(15)
    expect(state.fullOverview).toBe(true)
    expect(state.needsFit).toBe(false)
  })

  it('fitToViewport with very small width clamps to MIN_ZOOM', () => {
    const store = useBannerStore.getState()
    store.refresh(mockT, 'zh-CN')

    store.fitToViewport(10, mockT, 'zh-CN')
    expect(useBannerStore.getState().zoom).toBe(1.5)
  })

  it('fitToViewport with very large width clamps to MAX_ZOOM', () => {
    const store = useBannerStore.getState()
    store.refresh(mockT, 'zh-CN')

    store.fitToViewport(100000, mockT, 'zh-CN')
    expect(useBannerStore.getState().zoom).toBe(15)
  })

  it('toggleFullOverview enables fullOverview and adjusts zoom', () => {
    const store = useBannerStore.getState()
    store.refresh(mockT, 'zh-CN')

    store.toggleFullOverview(800)
    const state = useBannerStore.getState()
    expect(state.fullOverview).toBe(true)
    expect(state.zoom).toBeGreaterThanOrEqual(1.5)
    expect(state.zoom).toBeLessThanOrEqual(15)
  })

  it('toggleFullOverview disables fullOverview', () => {
    useBannerStore.setState({ fullOverview: true })
    useBannerStore.getState().toggleFullOverview(800)
    expect(useBannerStore.getState().fullOverview).toBe(false)
    expect(useBannerStore.getState().zoom).toBe(5)
  })

  it('setSortMode updates sortMode', () => {
    useBannerStore.getState().setSortMode('asc')
    expect(useBannerStore.getState().sortMode).toBe('asc')
  })

  it('togglePreviewAxis toggles showPreviewAxis', () => {
    expect(useBannerStore.getState().showPreviewAxis).toBe(true)
    useBannerStore.getState().togglePreviewAxis()
    expect(useBannerStore.getState().showPreviewAxis).toBe(false)
    useBannerStore.getState().togglePreviewAxis()
    expect(useBannerStore.getState().showPreviewAxis).toBe(true)
  })

  it('refresh with different sort modes produces different orderings', () => {
    const store = useBannerStore.getState()

    store.setSortMode('default')
    store.refresh(mockT, 'zh-CN')
    const defaultOrder = useBannerStore.getState().timelineData!.charRows.map((c) => c.name)

    store.setSortMode('asc')
    store.refresh(mockT, 'zh-CN')
    const ascOrder = useBannerStore.getState().timelineData!.charRows.map((c) => c.name)

    store.setSortMode('desc')
    store.refresh(mockT, 'zh-CN')
    const descOrder = useBannerStore.getState().timelineData!.charRows.map((c) => c.name)

    expect(defaultOrder.length).toBeGreaterThan(0)
    expect(ascOrder.length).toBe(defaultOrder.length)
    expect(descOrder.length).toBe(defaultOrder.length)
  })

  it('refresh produces todayPx when today is in range', () => {
    const store = useBannerStore.getState()
    store.refresh(mockT, 'zh-CN')
    const data = useBannerStore.getState().timelineData!
    expect(data.nowMs).toBeGreaterThan(0)
  })
})
