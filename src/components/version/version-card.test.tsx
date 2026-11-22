// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { VersionInfo } from '@/types/version'
import { VersionCard } from './version-card'

const labels: Record<string, string> = {
  'version.version': '版本',
  'version.commit': '提交',
  'version.commitCount': '提交次数',
  'version.commitTime': '提交时间',
  'version.buildTime': '构建时间',
  'version.gameDataVersion': '游戏数据版本',
  'version.gameDataPublishedAt': '数据资源发布时间',
}

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => labels[key] ?? key,
}))

function makeInfo(overrides: Partial<VersionInfo> = {}): VersionInfo {
  return {
    commit: '2db6d0c',
    count: 53,
    commitTime: '2026-11-21T23:27:42+08:00',
    buildTime: '2026-11-21T15:38:57.156Z',
    version: '0.1.0-2db6d0c',
    forceUpgradeSerial: 3,
    ...overrides,
  }
}

afterEach(cleanup)

describe('VersionCard', () => {
  it('shows the baked game data version next to the site version rows', () => {
    render(<VersionCard label="本地" info={makeInfo({
      gameData: { version: '1.6.4@11944529-13', publishedAt: '2026-11-21T19:33:07+08:00' },
    })} />)

    expect(screen.getByText('本地')).toBeTruthy()
    expect(screen.getByText('游戏数据版本')).toBeTruthy()
    expect(screen.getByText('1.6.4@11944529-13')).toBeTruthy()
    const publishedRow = screen.getByText('数据资源发布时间').parentElement
    expect(publishedRow?.textContent).toMatch(/数据资源发布时间\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
  })

  it('keeps long data ids inside the card', () => {
    render(<VersionCard label="本地" info={makeInfo({
      gameData: { version: '1.6.4@11944529-13', publishedAt: '2026-11-21T19:33:07+08:00' },
    })} />)

    const value = screen.getByText('1.6.4@11944529-13')
    expect(value.className).toContain('break-all')
    expect(value.className).toContain('text-right')
  })

  it('renders placeholders for builds without a data snapshot', () => {
    render(<VersionCard label="本地" info={makeInfo()} />)

    expect(screen.getByText('游戏数据版本')).toBeTruthy()
    expect(screen.queryByText('1.6.4@11944529-13')).toBeNull()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('keeps the published-at placeholder when only a legacy SHA was recorded', () => {
    render(<VersionCard label="本地" info={makeInfo({ gameData: { version: '2f74a11', publishedAt: null } })} />)

    expect(screen.getByText('2f74a11')).toBeTruthy()
    expect(screen.getAllByText('—')).toHaveLength(1)
  })
})
