// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
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

afterEach(() => {
  cleanup()
  resetMissingTranslationsForTests()
})

it('renders notification when a missing translation event is emitted', () => {
  render(<MissingTranslationNotifier />)
  expect(screen.queryByRole('alert')).toBeNull()

  act(() => {
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
  expect(link.getAttribute('href')).toContain('item%7Citem_unknown_script')
})
