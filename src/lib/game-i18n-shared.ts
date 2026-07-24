/** Shared types / pure helpers for chunked game I18nTextTable assets. */

export const GAME_I18N_LOCALES = ['zh-CN', 'en', 'ja', 'zh-TW'] as const
export type GameI18nLocale = (typeof GAME_I18N_LOCALES)[number]

export interface GameI18nChunkMeta {
  file: string
  count: number
  startId: string
  endId: string
  bytes: number
}

export interface GameI18nLocaleMeta {
  entryCount: number
  chunks: GameI18nChunkMeta[]
}

export interface GameI18nManifest {
  version: 1
  generatedAt: string
  maxChunkBytes: number
  locales: Record<GameI18nLocale, GameI18nLocaleMeta>
}

export function compareTextId(a: string, b: string): number {
  const left = BigInt(a)
  const right = BigInt(b)
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/** Binary-search chunk index for a textId within sorted chunk ranges. */
export function findChunkIndexForTextId(chunks: GameI18nChunkMeta[], textId: string): number {
  let low = 0
  let high = chunks.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const chunk = chunks[mid]
    if (compareTextId(textId, chunk.startId) < 0) high = mid - 1
    else if (compareTextId(textId, chunk.endId) > 0) low = mid + 1
    else return mid
  }
  return -1
}
