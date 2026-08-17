import type { ChangelogEntry } from '@/types/version'

const LAST_SEEN_KEY = 'cep-last-seen-commit'
const FALLBACK_LIMIT = 10

/**
 * 返回 changelog（最新在前）中比 seenCommit 更新的全部条目（不含 seenCommit 本身）。
 * 找不到 seenCommit（历史重写/回退）时回退为顶部 FALLBACK_LIMIT 条。
 */
export function getEntriesSince(changelog: ChangelogEntry[], seenCommit: string): ChangelogEntry[] {
  const idx = changelog.findIndex((entry) => entry.commit === seenCommit)
  if (idx === -1) return changelog.slice(0, FALLBACK_LIMIT)
  return changelog.slice(0, idx)
}

/**
 * 无本地记录（首次访问/首个支持该功能的版本）时的回退边界：
 * 返回最新一个带版本 tag 的条目之前的全部条目（不含该 tag 条目本身）；
 * 当该 tag 条目本身就是最新条目（idx === 0）时返回它自身，保证非空 changelog
 * 下回退结果不为空，避免"0 条内容却写入已看标记"导致的更新通知被静默吞掉。
 * 没有任何 tag 时回退为顶部 FALLBACK_LIMIT 条。
 */
export function getEntriesSinceLastTag(changelog: ChangelogEntry[]): ChangelogEntry[] {
  const idx = changelog.findIndex((entry) => Boolean(entry.version))
  if (idx === -1) return changelog.slice(0, FALLBACK_LIMIT)
  return changelog.slice(0, idx === 0 ? 1 : idx)
}

export function readLastSeenCommit(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(LAST_SEEN_KEY)
  } catch {
    return null
  }
}

export function writeLastSeenCommit(commit: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, commit)
  } catch {
    // 隐私模式/配额不足时静默失败：最坏情况是下次加载再次展示
  }
}

let changelogPromise: Promise<ChangelogEntry[]> | null = null

/**
 * 懒加载 /changelog.json 并缓存 promise，弹窗与更新页可共享同一份请求。
 * 失败时清空缓存，允许同会话内重试。
 */
export function fetchChangelog(): Promise<ChangelogEntry[]> {
  changelogPromise ??= fetch('/changelog.json', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error(`changelog fetch failed: ${res.status}`)
      return res.json() as Promise<{ changelog: ChangelogEntry[] }>
    })
    .then((data) => (Array.isArray(data.changelog) ? data.changelog : []))
    .catch((err) => {
      changelogPromise = null
      throw err
    })
  return changelogPromise
}
