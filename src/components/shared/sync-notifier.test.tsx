// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SyncNotifier } from './sync-notifier'
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
})
