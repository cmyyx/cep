// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  NOTICE_DISMISS_STORAGE_KEY,
  dismissNotice,
  getDismissedSignatureServerSnapshot,
  getDismissedSignatureSnapshot,
  noticeSignature,
  resetNoticeDismissForTests,
  subscribeNoticeDismiss,
} from './notice-dismiss'

describe('noticeSignature', () => {
  it('pairs the id with updatedAt so an edited notice comes back', () => {
    expect(noticeSignature({ id: 42, updatedAt: '2026-07-26T00:00:00Z' })).toBe(
      '42@2026-07-26T00:00:00Z'
    )
    // 同一 id 改了文案 → 签名不同 → 横幅重新弹出
    expect(noticeSignature({ id: 42, updatedAt: '2026-08-01T00:00:00Z' })).not.toBe(
      noticeSignature({ id: 42, updatedAt: '2026-07-26T00:00:00Z' })
    )
    // updatedAt 缺失 (旧版服务端) 仍然可用, 只是无法感知内容变更
    expect(noticeSignature({ id: 7 })).toBe('7@')
  })
})

describe('notice dismissal store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetNoticeDismissForTests()
  })

  afterEach(() => {
    window.localStorage.clear()
    resetNoticeDismissForTests()
    vi.restoreAllMocks()
  })

  it('starts with no dismissal and a null server snapshot', () => {
    expect(getDismissedSignatureSnapshot()).toBeNull()
    expect(getDismissedSignatureServerSnapshot()).toBeNull()
  })

  it('persists a dismissal and reflects it in the snapshot', () => {
    dismissNotice({ id: 42, updatedAt: '2026-07-26T00:00:00Z' })
    expect(getDismissedSignatureSnapshot()).toBe('42@2026-07-26T00:00:00Z')
    expect(window.localStorage.getItem(NOTICE_DISMISS_STORAGE_KEY)).toBe('42@2026-07-26T00:00:00Z')
  })

  it('notifies subscribers on dismissal', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeNoticeDismiss(listener)
    dismissNotice({ id: 1, updatedAt: 'now' })
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    subscribeNoticeDismiss(listener)()
    dismissNotice({ id: 1, updatedAt: 'now' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('picks up a dismissal made in another tab', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeNoticeDismiss(listener)

    window.localStorage.setItem(NOTICE_DISMISS_STORAGE_KEY, '9@other')
    window.dispatchEvent(new StorageEvent('storage', { key: NOTICE_DISMISS_STORAGE_KEY }))

    expect(getDismissedSignatureSnapshot()).toBe('9@other')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('ignores storage events for unrelated keys', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeNoticeDismiss(listener)

    window.localStorage.setItem(NOTICE_DISMISS_STORAGE_KEY, '9@other')
    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }))

    expect(getDismissedSignatureSnapshot()).toBeNull()
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('does not re-notify when a storage event carries the same value', () => {
    dismissNotice({ id: 9, updatedAt: 'other' })
    const listener = vi.fn()
    const unsubscribe = subscribeNoticeDismiss(listener)

    window.dispatchEvent(new StorageEvent('storage', { key: NOTICE_DISMISS_STORAGE_KEY }))

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('survives a storage that refuses to be read or written', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })

    // 关不掉的横幅好过崩掉的页面: 读写都失败时退化为"没有关闭记录", 但本次会话内
    // 内存里的值仍然生效, 点过关闭的访客不会立刻又看到它。
    expect(() => getDismissedSignatureSnapshot()).not.toThrow()
    expect(getDismissedSignatureSnapshot()).toBeNull()
    expect(() => dismissNotice({ id: 3, updatedAt: 'now' })).not.toThrow()
    expect(getDismissedSignatureSnapshot()).toBe('3@now')
  })

  it('removes the cross-tab listener once the last subscriber leaves', () => {
    const unsubscribe = subscribeNoticeDismiss(() => undefined)
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    unsubscribe()
    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function))
  })
})
