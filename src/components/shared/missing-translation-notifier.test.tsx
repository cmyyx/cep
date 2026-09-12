// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MissingTranslationNotifier } from './missing-translation-notifier'
import {
  reportMissingTranslation,
  resetMissingTranslationsForTests,
} from '@/lib/missing-translation-guard'

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

describe('MissingTranslationNotifier', () => {
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
    render(<MissingTranslationNotifier />)
    expect(screen.queryByRole('alert')).toBeNull()

    await act(async () => {
      reportMissingTranslation({
        key: 'item|item_unknown_script',
        locale: 'zh-CN',
        category: 'item',
      })
    })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('发现异常文本')).toBeTruthy()
    expect(screen.getByText('检测到 item|item_unknown_script 解析异常，欢迎向开发者反馈。')).toBeTruthy()

    const link = screen.getByRole('link', { name: '提交反馈' })
    const href = link.getAttribute('href') ?? ''
    expect(href).toContain('item%7Citem_unknown_script')
    // Ensure URL context is sanitized (no query params or hash)
    expect(href).toContain(encodeURIComponent('https://cep.app/wiki/equipment'))
    expect(href).not.toContain('secret123')
    expect(href).not.toContain('test-hash')
  })

  it('replays buffered event when reported before notifier mounts', async () => {
    // 1. Report before component is mounted
    reportMissingTranslation({
      key: 'item|item_early_report',
      locale: 'zh-CN',
      category: 'item',
    })

    // 2. Mount notifier afterwards
    await act(async () => {
      render(<MissingTranslationNotifier />)
    })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('检测到 item|item_early_report 解析异常，欢迎向开发者反馈。')).toBeTruthy()
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
          <MissingTranslationNotifier />
          <ChildWithMissingKey />
        </div>
      )
    })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('检测到 item|item_during_render 解析异常，欢迎向开发者反馈。')).toBeTruthy()
  })
})
