// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { VersionInfo } from '@/types/version'
import { VersionComparison } from './version-comparison'

const labels: Record<string, string> = {
  'version.local': '本地',
  'version.remote': '云端',
  'version.version': '版本',
  'version.commit': '提交',
  'version.commitCount': '提交次数',
  'version.commitTime': '提交时间',
  'version.buildTime': '构建时间',
  'version.gameDataVersion': '游戏数据版本',
  'version.gameDataPublishedAt': '数据资源发布时间',
  'version.updateAvailable': '发现新版本',
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
    gameData: { version: '1.6.4@11944529-12', publishedAt: '2026-11-14T10:02:38+08:00' },
    ...overrides,
  }
}

afterEach(cleanup)

describe('VersionComparison', () => {
  it('shows only the local card (with game data) before version.json is loaded', () => {
    render(<VersionComparison localInfo={makeInfo()} remoteInfo={null} isUpdateAvailable={false} />)

    expect(screen.getByText('本地')).toBeTruthy()
    expect(screen.queryByText('云端')).toBeNull()
    expect(screen.getByText('1.6.4@11944529-12')).toBeTruthy()
  })

  it('always shows both cards once the deployed version is known, even without an update', () => {
    render(<VersionComparison localInfo={makeInfo()} remoteInfo={makeInfo()} isUpdateAvailable={false} />)

    expect(screen.getByText('本地')).toBeTruthy()
    expect(screen.getByText('云端')).toBeTruthy()
    expect(screen.getAllByText('游戏数据版本')).toHaveLength(2)
    expect(screen.queryByText('发现新版本')).toBeNull()
    // 窄屏竖排、宽屏横排；箭头跟着换向
    const row = screen.getByText('本地').closest('.flex')
    expect(row?.className).toContain('flex-col')
    expect(row?.className).toContain('sm:flex-row')
    expect(document.querySelector('svg.rotate-90')).toBeTruthy()
  })

  it('keeps the update banner separate from the data comparison', () => {
    render(<VersionComparison
      localInfo={makeInfo()}
      remoteInfo={makeInfo({ commit: 'fff0000', gameData: { version: '1.6.4@11944529-13', publishedAt: '2026-11-21T19:33:07+08:00' } })}
      isUpdateAvailable
    />)

    expect(screen.getByText('发现新版本')).toBeTruthy()
    expect(screen.getByText('1.6.4@11944529-12')).toBeTruthy()
    expect(screen.getByText('1.6.4@11944529-13')).toBeTruthy()
  })
})
