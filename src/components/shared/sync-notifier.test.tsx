// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SyncNotifier } from './sync-notifier'
import { showAppToast } from '@/lib/app-toast'
import { notifySync } from '@/hooks/useAutoSync'
import {
  reportMissingTranslation,
  resetMissingTranslationsForTests,
} from '@/lib/missing-translation-guard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/wiki/equipment',
}))

vi.mock('@/hooks/use-version', () => ({
  useVersion: () => ({
    isUpdateAvailable: false,
    refreshPage: vi.fn(),
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { key?: string }) => {
    if (key === 'common.missingTranslationTitle') return '发现异常文本'
    if (key === 'common.missingTranslationDesc') return `检测到 ${values?.key} 解析异常，欢迎向开发者反馈。`
    if (key === 'common.copyReportInfo') return '复制反馈信息'
    if (key === 'common.reportCopied') return '已复制'
    if (key === 'common.reportToGithub') return '提交反馈'
    if (key === 'common.close') return '关闭'
    return key
  },
  useLocale: () => 'zh-CN',
}))

describe('SyncNotifier - Missing Translation integration', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        origin: 'https://cep.app',
        pathname: '/wiki/equipment',
        search: '?token=secret123',
        hash: '#test-hash',
        href: 'https://cep.app/wiki/equipment?token=secret123#test-hash',
      },
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    cleanup()
    resetMissingTranslationsForTests()
  })

  it('renders notification when a missing translation event is emitted while mounted', async () => {
    render(<SyncNotifier />)
    expect(screen.queryByRole('alert')).toBeNull()

    await act(async () => {
      reportMissingTranslation({
        key: 'item|item_unknown_script',
        locale: 'zh-CN',
        category: 'item',
      })
    })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('发现异常文本: item|item_unknown_script')).toBeTruthy()

    const link = screen.getByRole('link', { name: '提交反馈' })
    const href = link.getAttribute('href') ?? ''
    expect(href).toContain('item%7Citem_unknown_script')
    expect(href).toContain(encodeURIComponent('https://cep.app/wiki/equipment'))
  })

  it('replays buffered event when reported before notifier mounts', async () => {
    reportMissingTranslation({
      key: 'item|item_early_report',
      locale: 'zh-CN',
      category: 'item',
    })

    await act(async () => {
      render(<SyncNotifier />)
    })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('发现异常文本: item|item_early_report')).toBeTruthy()
  })

  it('handles reporting during component render phase without breaking', async () => {
    function ChildWithMissingKey() {
      reportMissingTranslation({
        key: 'item|item_during_render',
        locale: 'zh-CN',
        category: 'item',
      })
      return <div>Child Content</div>
    }

    await act(async () => {
      render(
        <div>
          <SyncNotifier />
          <ChildWithMissingKey />
        </div>
      )
    })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('发现异常文本: item|item_during_render')).toBeTruthy()
  })

  it('updates copied state on copy click and does not leak copied state to replaced toast', async () => {
    vi.useFakeTimers()
    try {
      render(<SyncNotifier />)

      await act(async () => {
        reportMissingTranslation({
          key: 'item|item_first',
          locale: 'zh-CN',
          category: 'item',
        })
      })

      const copyButton = screen.getByRole('button', { name: '复制反馈信息' })
      expect(copyButton).toBeTruthy()

      await act(async () => {
        copyButton.click()
      })

      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: '已复制' })).toBeTruthy()

      // Replace toast before the 2s timeout
      await act(async () => {
        reportMissingTranslation({
          key: 'item|item_second',
          locale: 'zh-CN',
          category: 'item',
        })
      })

      // Advance past transition timeout (220ms) to mount the new toast
      await act(async () => {
        vi.advanceTimersByTime(250)
      })

      // The new toast must not inherit copied state
      expect(screen.getByText('发现异常文本: item|item_second')).toBeTruthy()
      expect(screen.getByRole('button', { name: '复制反馈信息' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: '已复制' })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('SyncNotifier - app messages stack with sync notices', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders a data-import result in the shared toast stack instead of a second overlay', async () => {
    render(<SyncNotifier />)

    await act(async () => {
      showAppToast({ tone: 'success', text: '数据导入成功' })
    })

    // Exactly one bottom-right container lives in the DOM — the import dialog no
    // longer renders its own overlay at the same position.
    expect(screen.getByText('数据导入成功')).toBeTruthy()
    expect(document.querySelectorAll('.fixed.bottom-6.right-6')).toHaveLength(1)

    // 通知堆必须浮在对话框之上（对话框 z-50），否则对话框的遮罩会把通知压住。
    const zIndex = Number(document.querySelector('.fixed.bottom-6.right-6')?.className.match(/z-\[(\d+)\]/)?.[1])
    expect(zIndex).toBeGreaterThanOrEqual(50)
  })

  it('shows an app message beside a persistent conflict toast instead of queueing it', async () => {
    vi.useFakeTimers()
    try {
      render(<SyncNotifier />)

      await act(async () => {
        notifySync({ type: 'push_conflict' })
      })
      await act(async () => {
        vi.advanceTimersByTime(400)
      })
      await act(async () => {
        showAppToast({ tone: 'error', text: '文件格式不支持' })
      })

      expect(screen.getByText('account.syncConflictToast')).toBeTruthy()
      expect(screen.getByText('文件格式不支持')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps every app message from the same batch visible at once', async () => {
    render(<SyncNotifier />)

    await act(async () => {
      showAppToast({ tone: 'error', text: '第一条：文件格式不支持' })
      showAppToast({ tone: 'success', text: '第二条：导入完成' })
    })

    expect(screen.getByText('第一条：文件格式不支持')).toBeTruthy()
    expect(screen.getByText('第二条：导入完成')).toBeTruthy()
  })

  it('lets each toast expire on its own timer without cutting others short', async () => {
    vi.useFakeTimers()
    try {
      render(<SyncNotifier />)

      await act(async () => {
        notifySync({ type: 'pull_success' })
      })
      await act(async () => {
        vi.advanceTimersByTime(400)
      })
      // 瞬时通知在场时再来一条持久通知, 两者的定时器互不影响。
      await act(async () => {
        notifySync({ type: 'push_conflict' })
      })
      expect(screen.getByText('account.syncDownloaded')).toBeTruthy()

      await act(async () => {
        vi.advanceTimersByTime(6000)
      })
      expect(screen.queryByText('account.syncDownloaded')).toBeNull()
      expect(screen.getByText('account.syncConflictToast')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not lose an app message that arrives while a sync toast is fading out', async () => {
    vi.useFakeTimers()
    try {
      render(<SyncNotifier />)

      await act(async () => {
        notifySync({ type: 'push_conflict' })
      })
      await act(async () => {
        vi.advanceTimersByTime(400)
      })
      await act(async () => {
        screen.getAllByRole('button', { name: '关闭' })[0].click()
      })
      // 淡出中 (220ms 内) 到达的新消息不能被别人的收尾流程吞掉。
      await act(async () => {
        showAppToast({ tone: 'success', text: '导入完成' })
      })
      await act(async () => {
        vi.advanceTimersByTime(400)
      })

      expect(screen.getByText('导入完成')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
