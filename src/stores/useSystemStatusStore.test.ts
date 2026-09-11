import { describe, it, expect, beforeEach } from 'vitest'
import { useSystemStatusStore } from './useSystemStatusStore'

describe('useSystemStatusStore', () => {
  beforeEach(() => {
    useSystemStatusStore.setState({ maintenance: false })
  })

  it('默认不处于维护状态', () => {
    expect(useSystemStatusStore.getState().maintenance).toBe(false)
  })

  it('reportMaintenance 置为维护中', () => {
    useSystemStatusStore.getState().reportMaintenance()
    expect(useSystemStatusStore.getState().maintenance).toBe(true)
  })

  it('reportHealthy 清除维护状态', () => {
    useSystemStatusStore.getState().reportMaintenance()
    useSystemStatusStore.getState().reportHealthy()
    expect(useSystemStatusStore.getState().maintenance).toBe(false)
  })

  it('重复上报同一状态不改变引用（避免多余渲染）', () => {
    useSystemStatusStore.getState().reportMaintenance()
    const first = useSystemStatusStore.getState()
    useSystemStatusStore.getState().reportMaintenance()
    expect(useSystemStatusStore.getState()).toBe(first)

    useSystemStatusStore.getState().reportHealthy()
    const healthy = useSystemStatusStore.getState()
    useSystemStatusStore.getState().reportHealthy()
    expect(useSystemStatusStore.getState()).toBe(healthy)
  })
})
