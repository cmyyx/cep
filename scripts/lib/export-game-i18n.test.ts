import { expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compareTextId, findChunkIndexForTextId, type GameI18nChunkMeta } from '../../src/lib/game-i18n-shared'
import {
  assertSafeMaxChunkBytes,
  entrySerializedBytes,
  packGameI18nChunks,
  parseMaxChunkBytesArg,
  resolveAkedataPath,
} from './export-game-i18n'

it('orders signed text ids with BigInt semantics', () => {
  expect(compareTextId('-2', '-1')).toBeLessThan(0)
  expect(compareTextId('-1', '1')).toBeLessThan(0)
  expect(compareTextId('10', '2')).toBeGreaterThan(0)
})

it('rejects unsafe maxChunkBytes values', () => {
  expect(() => assertSafeMaxChunkBytes(Number.NaN)).toThrow(/safe integer/)
  expect(() => assertSafeMaxChunkBytes(Number.POSITIVE_INFINITY)).toThrow(/safe integer/)
  expect(() => assertSafeMaxChunkBytes(1023)).toThrow(/safe integer/)
  expect(() => assertSafeMaxChunkBytes(1.5)).toThrow(/safe integer/)
  expect(assertSafeMaxChunkBytes(1024)).toBe(1024)
})

it('parses CLI max-chunk-bytes with fallback', () => {
  expect(parseMaxChunkBytesArg(undefined, 4096)).toBe(4096)
  expect(parseMaxChunkBytesArg('8192', 4096)).toBe(8192)
  expect(() => parseMaxChunkBytesArg('nope', 4096)).toThrow(/safe integer/)
  expect(() => parseMaxChunkBytesArg('100', 4096)).toThrow(/safe integer/)
})

it('resolves akedata path with --akedata over config', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-game-i18n-cli-'))
  try {
    writeFileSync(
      join(root, 'sync-game-data.config.json'),
      JSON.stringify({ akedataPath: 'D:/from-config' }),
      'utf8',
    )
    expect(
      resolveAkedataPath({
        args: ['--akedata', 'D:/from-cli'],
        projectRoot: root,
      }),
    ).toBe('D:/from-cli')
    expect(
      resolveAkedataPath({
        args: [],
        projectRoot: root,
      }),
    ).toBe('D:/from-config')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('throws when akedata path is missing from CLI and config', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-game-i18n-cli-missing-'))
  try {
    expect(() => resolveAkedataPath({ args: [], projectRoot: root })).toThrow(/akedataPath required/)
    writeFileSync(join(root, 'sync-game-data.config.json'), JSON.stringify({}), 'utf8')
    expect(() => resolveAkedataPath({ args: [], projectRoot: root })).toThrow(/akedataPath required/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('packs entries so each chunk stays under the byte budget', () => {
  const entries = Array.from({ length: 200 }, (_, index) => [`${index}`, `value-${index}-${'x'.repeat(40)}`] as const)
  const budget = 4_000
  const chunks = packGameI18nChunks(entries, budget)
  expect(chunks.length).toBeGreaterThan(1)
  for (const chunk of chunks) {
    expect(chunk.bytes).toBeLessThanOrEqual(budget)
    expect(chunk.count).toBe(Object.keys(chunk.map).length)
    expect(chunk.startId).toBeTruthy()
    expect(chunk.endId).toBeTruthy()
    expect(Buffer.byteLength(JSON.stringify(chunk.map), 'utf8')).toBeLessThanOrEqual(budget)
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.count, 0)
  expect(total).toBe(200)
})

it('throws when a single entry cannot fit in maxChunkBytes', () => {
  const huge = 'x'.repeat(2000)
  expect(() => packGameI18nChunks([['1', huge]], 1024)).toThrow(/single entry exceeds maxChunkBytes/)
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

it('entrySerializedBytes accounts for JSON quoting', () => {
  const id = '12'
  const text = 'a"b'
  const expected =
    Buffer.byteLength(JSON.stringify(id), 'utf8') + 1 + Buffer.byteLength(JSON.stringify(text), 'utf8')
  expect(entrySerializedBytes(id, text, false)).toBe(expected)
  expect(entrySerializedBytes(id, text, true)).toBe(expected + 1)
})
