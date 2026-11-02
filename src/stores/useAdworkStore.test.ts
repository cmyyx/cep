import { beforeEach, describe, expect, it } from 'vitest'
import { resetAdworkStoreForTests, useAdworkStore } from './useAdworkStore'

beforeEach(resetAdworkStoreForTests)

describe('useAdworkStore', () => {
  it('stores why a placement is unavailable', () => {
    useAdworkStore.getState().setUnavailable('desktop', 'blank')

    expect(useAdworkStore.getState().phases.desktop).toBe('unavailable')
    expect(useAdworkStore.getState().unavailableReasons.desktop).toBe('blank')
  })

  it('clears the previous unavailable reason on every other phase', () => {
    useAdworkStore.getState().setUnavailable('desktop', 'disabled')
    useAdworkStore.getState().setPhase('desktop', 'loaded')

    expect(useAdworkStore.getState().phases.desktop).toBe('loaded')
    expect(useAdworkStore.getState().unavailableReasons.desktop).toBeNull()
  })

  it('keeps the two slots independent', () => {
    useAdworkStore.getState().setUnavailable('mobile', 'disabled')
    useAdworkStore.getState().setPhase('desktop', 'failed')

    expect(useAdworkStore.getState().phases.mobile).toBe('unavailable')
    expect(useAdworkStore.getState().unavailableReasons.mobile).toBe('disabled')
    expect(useAdworkStore.getState().phases.desktop).toBe('failed')
    expect(useAdworkStore.getState().unavailableReasons.desktop).toBeNull()
  })
})
