import { describe, it, expect, beforeEach } from 'vitest'
import { useToastUiStore } from './useToastUiStore'

describe('useToastUiStore', () => {
  beforeEach(() => {
    useToastUiStore.setState({ syncToastVisible: false })
  })

  it('默认 syncToastVisible 为 false', () => {
    expect(useToastUiStore.getState().syncToastVisible).toBe(false)
  })

  it('setSyncToastVisible 更新可见状态', () => {
    useToastUiStore.getState().setSyncToastVisible(true)
    expect(useToastUiStore.getState().syncToastVisible).toBe(true)
    useToastUiStore.getState().setSyncToastVisible(false)
    expect(useToastUiStore.getState().syncToastVisible).toBe(false)
  })
})
