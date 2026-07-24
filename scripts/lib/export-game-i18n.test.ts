import { expect, it } from 'vitest'
import { compareTextId, findChunkIndexForTextId, type GameI18nChunkMeta } from '../../src/lib/game-i18n-shared'
import { packGameI18nChunks } from './export-game-i18n'

it('orders signed text ids with BigInt semantics', () => {
  expect(compareTextId('-2', '-1')).toBeLessThan(0)
  expect(compareTextId('-1', '1')).toBeLessThan(0)
  expect(compareTextId('10', '2')).toBeGreaterThan(0)
})

it('packs entries so each chunk stays under the byte budget', () => {
  const entries = Array.from({ length: 200 }, (_, index) => [`${index}`, `value-${index}-${'x'.repeat(40)}`] as const)
  const chunks = packGameI18nChunks(entries, 4_000)
  expect(chunks.length).toBeGreaterThan(1)
  for (const chunk of chunks) {
    expect(chunk.bytes).toBeLessThanOrEqual(4_000 + 200)
    expect(chunk.count).toBe(Object.keys(chunk.map).length)
    expect(chunk.startId).toBeTruthy()
    expect(chunk.endId).toBeTruthy()
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.count, 0)
  expect(total).toBe(200)
})

it('finds chunk index by textId range', () => {
  const chunks: GameI18nChunkMeta[] = [
    { file: 'a', count: 2, startId: '1', endId: '10', bytes: 1 },
    { file: 'b', count: 2, startId: '11', endId: '20', bytes: 1 },
    { file: 'c', count: 1, startId: '21', endId: '30', bytes: 1 },
  ]
  expect(findChunkIndexForTextId(chunks, '5')).toBe(0)
  expect(findChunkIndexForTextId(chunks, '15')).toBe(1)
  expect(findChunkIndexForTextId(chunks, '25')).toBe(2)
  expect(findChunkIndexForTextId(chunks, '100')).toBe(-1)
})
