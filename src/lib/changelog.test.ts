import { describe, it, expect } from 'vitest'
import { getEntriesSince, getEntriesSinceLastTag } from './changelog'
import type { ChangelogEntry } from '@/types/version'

function makeEntry(commit: string, version?: string): ChangelogEntry {
  return {
    commit,
    commitTime: '2026-08-10T00:00:00+08:00',
    message: `message-${commit}`,
    ...(version ? { version } : {}),
    forceUpdate: false,
  }
}

// 最新在前:c5(最新) → c1(最旧)
const changelog: ChangelogEntry[] = [
  makeEntry('c5'),
  makeEntry('c4', 'v1.4.25'),
  makeEntry('c3'),
  makeEntry('c2', 'v1.4.24'),
  makeEntry('c1'),
]

describe('getEntriesSince', () => {
  it('返回 seenCommit 之后的全部条目(不含 seenCommit 本身)', () => {
    expect(getEntriesSince(changelog, 'c2').map((e) => e.commit)).toEqual(['c5', 'c4', 'c3'])
  })

  it('seenCommit 为最新条目时返回空数组', () => {
    expect(getEntriesSince(changelog, 'c5')).toEqual([])
  })

  it('seenCommit 在最旧位置时返回其余全部条目', () => {
    expect(getEntriesSince(changelog, 'c1').map((e) => e.commit)).toEqual(['c5', 'c4', 'c3', 'c2'])
  })

  it('找不到 seenCommit(历史重写)时回退为顶部 10 条', () => {
    const entries = getEntriesSince(changelog, 'ghost-commit')
    expect(entries.map((e) => e.commit)).toEqual(['c5', 'c4', 'c3', 'c2', 'c1'])
  })

  it('空 changelog 返回空数组', () => {
    expect(getEntriesSince([], 'c1')).toEqual([])
  })
})

describe('getEntriesSinceLastTag', () => {
  it('返回最新一个带版本 tag 的条目之前的全部条目(不含 tag 条目)', () => {
    expect(getEntriesSinceLastTag(changelog).map((e) => e.commit)).toEqual(['c5'])
  })

  it('最新条目本身就是 tag 时返回空数组', () => {
    const taggedTop = [makeEntry('c6', 'v1.4.26'), ...changelog]
    expect(getEntriesSinceLastTag(taggedTop)).toEqual([])
  })

  it('没有任何 tag 时回退为顶部 10 条', () => {
    const noTags = changelog.map((e) => makeEntry(e.commit))
    expect(getEntriesSinceLastTag(noTags).map((e) => e.commit)).toEqual(['c5', 'c4', 'c3', 'c2', 'c1'])
  })

  it('空 changelog 返回空数组', () => {
    expect(getEntriesSinceLastTag([])).toEqual([])
  })
})
