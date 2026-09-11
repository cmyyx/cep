// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { useSystemStatusStore } from '@/stores/useSystemStatusStore'
import {
  MAINTENANCE_PROBE_INTERVAL_MS,
  MAINTENANCE_PROBE_PATH,
  useMaintenanceProbe,
} from './use-maintenance-probe'

const mocks = vi.hoisted(() => ({ api: vi.fn(async () => ({})) }))

vi.mock('@/lib/api', () => ({ api: mocks.api }))

function Probe() {
  useMaintenanceProbe()
  return null
}

describe('useMaintenanceProbe', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.api.mockClear()
    useSystemStatusStore.setState({ maintenance: false })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('非维护状态不发起探测', async () => {
    render(<Probe />)
    await act(async () => {
      vi.advanceTimersByTime(MAINTENANCE_PROBE_INTERVAL_MS * 2)
    })
    expect(mocks.api).not.toHaveBeenCalled()
  })

  it('维护状态期间按间隔探测被维护拦截的接口', async () => {
    useSystemStatusStore.setState({ maintenance: true })
    render(<Probe />)

    await act(async () => {
      vi.advanceTimersByTime(MAINTENANCE_PROBE_INTERVAL_MS)
    })
    expect(mocks.api).toHaveBeenCalledTimes(1)
    expect(mocks.api).toHaveBeenCalledWith(MAINTENANCE_PROBE_PATH, { noAuth: true })

    await act(async () => {
      vi.advanceTimersByTime(MAINTENANCE_PROBE_INTERVAL_MS)
    })
    expect(mocks.api).toHaveBeenCalledTimes(2)
  })

  it('恢复后停止探测', async () => {
    useSystemStatusStore.setState({ maintenance: true })
    render(<Probe />)

    await act(async () => {
      vi.advanceTimersByTime(MAINTENANCE_PROBE_INTERVAL_MS)
    })
    expect(mocks.api).toHaveBeenCalledTimes(1)

    act(() => {
      useSystemStatusStore.getState().reportHealthy()
    })
    await act(async () => {
      vi.advanceTimersByTime(MAINTENANCE_PROBE_INTERVAL_MS * 3)
    })
    expect(mocks.api).toHaveBeenCalledTimes(1)
  })

  it('探测失败不抛出（结果由 API 客户端上报）', async () => {
    mocks.api.mockRejectedValueOnce(new Error('maintenance_mode'))
    useSystemStatusStore.setState({ maintenance: true })
    render(<Probe />)

    await act(async () => {
      vi.advanceTimersByTime(MAINTENANCE_PROBE_INTERVAL_MS)
    })
    expect(mocks.api).toHaveBeenCalledTimes(1)
  })
})
