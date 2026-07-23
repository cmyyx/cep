import { afterEach, expect, it, vi } from 'vitest'
import {
  isTooltipScrollLocked,
  lockTooltipsForScroll,
  resetTooltipScrollLockForTests,
  subscribeTooltipScrollClose,
} from './tooltip-scroll-lock'

afterEach(() => {
  resetTooltipScrollLockForTests()
  vi.useRealTimers()
})

it('locks immediately and unlocks after the debounce window', () => {
  vi.useFakeTimers()
  expect(isTooltipScrollLocked()).toBe(false)
  lockTooltipsForScroll(200)
  expect(isTooltipScrollLocked()).toBe(true)
  vi.advanceTimersByTime(199)
  expect(isTooltipScrollLocked()).toBe(true)
  vi.advanceTimersByTime(1)
  expect(isTooltipScrollLocked()).toBe(false)
})

it('extends the lock when scroll keeps firing', () => {
  vi.useFakeTimers()
  lockTooltipsForScroll(200)
  vi.advanceTimersByTime(150)
  lockTooltipsForScroll(200)
  vi.advanceTimersByTime(150)
  expect(isTooltipScrollLocked()).toBe(true)
  vi.advanceTimersByTime(50)
  expect(isTooltipScrollLocked()).toBe(false)
})

it('notifies close subscribers on every lock engagement', () => {
  const onClose = vi.fn()
  const unsubscribe = subscribeTooltipScrollClose(onClose)
  lockTooltipsForScroll(200)
  lockTooltipsForScroll(200)
  expect(onClose).toHaveBeenCalledTimes(2)
  unsubscribe()
  lockTooltipsForScroll(200)
  expect(onClose).toHaveBeenCalledTimes(2)
})
