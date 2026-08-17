// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup, screen } from '@testing-library/react'
import type { ChangelogEntry } from '@/types/version'

const mockT = (key: string) => {
  if (key === 'version.updateChangelogTitle') return '本次更新内容'
  if (key === 'version.viewFullChangelog') return '查看完整更新日志'
  if (key === 'version.forcedRelease') return '强制更新'
  if (key === 'common.close') return '关闭'
  return key
}

let mockCommit = 'c5'
let mockFetchImpl: () => Promise<{ ok: boolean; json: () => Promise<unknown> }>
const mockPush = vi.fn()

vi.mock('@/hooks/use-version', () => ({
  useVersion: () => ({ localInfo: { commit: mockCommit } }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
  useLocale: () => 'zh-CN',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

function makeEntries(n: number): ChangelogEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    commit: `c${n - i}`,
    commitTime: '2026-08-10T00:00:00+08:00',
    message: `message-${n - i}`,
    forceUpdate: false,
  }))
}

function okResponse(changelog: ChangelogEntry[]) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ changelog }) })
}
let Component: typeof import('./update-changelog-notice').UpdateChangelogNotice
let useToastUiStore: typeof import('@/stores/useToastUiStore').useToastUiStore
describe('UpdateChangelogNotice', () => {
  beforeEach(async () => {
    // resetModules 清空 lib/changelog 的 fetch promise 缓存
    vi.resetModules()
    localStorage.clear()
    mockCommit = 'c5'
    mockPush.mockReset()
    mockFetchImpl = () => okResponse(makeEntries(3))
    vi.stubGlobal('fetch', vi.fn(() => mockFetchImpl() as Promise<Response>))
    ;({ UpdateChangelogNotice: Component } = await import('./update-changelog-notice'))
    ;({ useToastUiStore } = await import('@/stores/useToastUiStore'))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('无本地记录(B2 回退)时展示自最近 release tag 起的条目并写入已看标记', async () => {
    render(<Component />)
    const card = await screen.findByTestId('update-changelog-notice')
    expect(card).toBeTruthy()
    expect(screen.getByText('本次更新内容')).toBeTruthy()
    expect(screen.getByText('message-3')).toBeTruthy()
    // 不超过 10 条时不展示完整日志按钮
    expect(screen.queryByRole('button', { name: '查看完整更新日志' })).toBeNull()
    expect(localStorage.getItem('cep-last-seen-commit')).toBe('c5')
  })

  it('lastSeenCommit 与当前 commit 相同(同 commit 重部署)时不展示且不请求', () => {
    localStorage.setItem('cep-last-seen-commit', 'c5')
    render(<Component />)
    expect(screen.queryByTestId('update-changelog-notice')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('存在旧记录时展示该记录之后的条目(不含记录本身)', async () => {
    mockFetchImpl = () => okResponse(makeEntries(5))
    localStorage.setItem('cep-last-seen-commit', 'c2')
    render(<Component />)
    await screen.findByTestId('update-changelog-notice')
    expect(screen.getByText('message-5')).toBeTruthy()
    expect(screen.getByText('message-3')).toBeTruthy()
    expect(screen.queryByText('message-2')).toBeNull()
    expect(screen.queryByText('message-1')).toBeNull()
  })

  it('超过 10 条时展示完整日志按钮,点击跳转 /update', async () => {
    // 最旧一条打上 release tag,使无记录回退边界落在第 11 条 → 11 条新内容 > 10
    const list = makeEntries(12)
    list[list.length - 1].version = 'v1.4.20'
    mockFetchImpl = () => okResponse(list)
    render(<Component />)
    await screen.findByTestId('update-changelog-notice')
    const button = screen.getByRole('button', { name: '查看完整更新日志' })
    expect(button).toBeTruthy()
    // 列表只渲染前 10 条
    expect(screen.getByText('message-12')).toBeTruthy()
    expect(screen.queryByText('message-2')).toBeNull()
    fireEvent.click(button)
    expect(mockPush).toHaveBeenCalledWith('/zh-CN/update')
  })

  it('点击关闭按钮后窗口消失,已看标记保留', async () => {
    render(<Component />)
    await screen.findByTestId('update-changelog-notice')
    fireEvent.click(screen.getByLabelText('关闭'))
    expect(screen.queryByTestId('update-changelog-notice')).toBeNull()
    expect(localStorage.getItem('cep-last-seen-commit')).toBe('c5')
  })

  it('changelog 加载失败时静默且不写入已看标记', async () => {
    mockFetchImpl = () => Promise.reject(new Error('network down'))
    render(<Component />)
    // 等待 fetch 被调用且 promise 结算
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByTestId('update-changelog-notice')).toBeNull()
    expect(localStorage.getItem('cep-last-seen-commit')).toBeNull()
  })

  it('无记录且最新条目本身是 release tag 时展示该 release 条目并写入已看标记', async () => {
    const taggedTop = [{ ...makeEntries(1)[0], version: 'v1.4.24' }]
    mockFetchImpl = () => okResponse(taggedTop)
    render(<Component />)
    const card = await screen.findByTestId('update-changelog-notice')
    expect(card).toBeTruthy()
    expect(screen.getByText('message-1')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '查看完整更新日志' })).toBeNull()
    expect(localStorage.getItem('cep-last-seen-commit')).toBe('c5')
  })

  it('changelog 为空时既不展示也不写入已看标记', async () => {
    mockFetchImpl = () => okResponse([])
    render(<Component />)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    // 等待 promise 链结算后再断言
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('update-changelog-notice')).toBeNull()
    expect(localStorage.getItem('cep-last-seen-commit')).toBeNull()
  })

  it('无记录且无 release tag 时兜底展示顶部 10 条,并提供完整日志入口', async () => {
    // 12 条无 tag:回退 slice(0, 10) 恰好 10 条,但完整 changelog 更长
    mockFetchImpl = () => okResponse(makeEntries(12))
    render(<Component />)
    const card = await screen.findByTestId('update-changelog-notice')
    expect(card).toBeTruthy()
    expect(screen.getByText('message-12')).toBeTruthy()
    expect(screen.queryByText('message-2')).toBeNull()
    expect(screen.getByRole('button', { name: '查看完整更新日志' })).toBeTruthy()
  })

  it('历史重写(找不到 seenCommit)兜底展示顶部 10 条,并提供完整日志入口', async () => {
    localStorage.setItem('cep-last-seen-commit', 'ghost-commit')
    mockFetchImpl = () => okResponse(makeEntries(12))
    render(<Component />)
    const card = await screen.findByTestId('update-changelog-notice')
    expect(card).toBeTruthy()
    expect(screen.getByText('message-12')).toBeTruthy()
    expect(screen.queryByText('message-2')).toBeNull()
    expect(screen.getByRole('button', { name: '查看完整更新日志' })).toBeTruthy()
  })

  it('无 sync toast 时贴底(bottom-6)对齐 toast 槽位', async () => {
    render(<Component />)
    const card = await screen.findByTestId('update-changelog-notice')
    expect(card.className).toContain('bottom-6')
    expect(card.className).not.toContain('bottom-24')
  })

  it('sync toast 显示时上移避让(bottom-24)', async () => {
    useToastUiStore.getState().setSyncToastVisible(true)
    render(<Component />)
    const card = await screen.findByTestId('update-changelog-notice')
    expect(card.className).toContain('bottom-24')
    expect(card.className).not.toContain('bottom-6')
  })
})
