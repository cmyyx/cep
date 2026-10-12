import { describe, expect, it, vi } from 'vitest'
import { hasAppToastHandler, setAppToastHandler, showAppToast } from './app-toast'

describe('app toast channel', () => {
  it('forwards an event to the registered handler', () => {
    const handler = vi.fn()
    setAppToastHandler(handler)

    showAppToast({ tone: 'success', text: '已导入' })

    expect(handler).toHaveBeenCalledWith({ tone: 'success', text: '已导入' })
    setAppToastHandler(null)
  })

  it('is a no-op when no toast surface is mounted', () => {
    setAppToastHandler(null)

    expect(hasAppToastHandler()).toBe(false)
    expect(() => showAppToast({ tone: 'error', text: '失败' })).not.toThrow()
  })
})
