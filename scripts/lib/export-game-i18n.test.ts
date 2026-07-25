import { expect, it } from 'vitest'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { compareTextId, findChunkIndexForTextId, type GameI18nChunkMeta } from '../../src/lib/game-i18n-shared'
import {
  assertSafeMaxChunkBytes,
  entrySerializedBytes,
  exportGameI18nTables,
  GAME_I18N_LOCALES,
  GAME_I18N_UPSTREAM_SUFFIX,
  packGameI18nChunks,
  parseMaxChunkBytesArg,
  installExportDirectory,
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

it('ignores successful-install cleanup failures', () => {
  const cleanupPaths: string[] = []
  const removeWithFileLock: typeof rmSync = (path) => {
    cleanupPaths.push(String(path))
    throw new Error('simulated Windows file lock')
  }

  expect(() =>
    installExportDirectory('temp', 'output', {
      cpSync,
      existsSync: () => true,
      renameSync: () => {},
      rmSync: removeWithFileLock,
    }),
  ).not.toThrow()
  expect(cleanupPaths).toHaveLength(2)
  expect(cleanupPaths[0]).toBe('temp')
  expect(cleanupPaths[1]).toContain('.game-i18n-backup-')
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

it('replaces an existing export and falls back to copy when install rename fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-game-i18n-export-'))
  const akedata = join(root, 'akedata')
  const tableDir = join(akedata, 'TableCfg')
  const outputDir = join(root, 'output')
  mkdirSync(tableDir, { recursive: true })
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(join(outputDir, 'stale.json'), '{"stale":true}', 'utf8')

  const writeTables = (value: string) => {
    for (const locale of GAME_I18N_LOCALES) {
      writeFileSync(
        join(tableDir, `I18nTextTable_${GAME_I18N_UPSTREAM_SUFFIX[locale]}.json`),
        JSON.stringify({ '10001': `${value}-${locale}`, '10002': `${value}-second-${locale}` }),
        'utf8',
      )
    }
  }

  try {
    writeTables('first')
    const first = exportGameI18nTables(akedata, outputDir, 1024)
    expect(existsSync(join(outputDir, 'stale.json'))).toBe(false)
    expect(first.manifest.locales.en.entryCount).toBe(2)
    expect(first.manifest.locales.en.chunks[0]).toMatchObject({ count: 2, startId: '10001', endId: '10002' })

    writeTables('second')
    const renameWithInstallFailure: typeof renameSync = (source, destination) => {
      if (basename(String(source)).startsWith('.game-i18n-tmp-') && String(destination) === outputDir) {
        throw new Error('simulated install rename failure')
      }
      renameSync(source, destination)
    }
    const second = exportGameI18nTables(akedata, outputDir, 1024, {
      cpSync,
      existsSync,
      renameSync: renameWithInstallFailure,
      rmSync,
    })
    const chunk = JSON.parse(readFileSync(join(outputDir, 'en', '000.json'), 'utf8')) as Record<string, string>
    const manifest = JSON.parse(readFileSync(join(outputDir, 'manifest.json'), 'utf8')) as typeof second.manifest
    expect(chunk['10001']).toBe('second-en')
    expect(manifest.locales.en.chunks).toEqual(second.manifest.locales.en.chunks)
    expect(manifest.locales.en.entryCount).toBe(2)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 15_000)

it('restores the previous export when rename and copy installation both fail', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-game-i18n-restore-'))
  const akedata = join(root, 'akedata')
  const tableDir = join(akedata, 'TableCfg')
  const outputDir = join(root, 'output')
  mkdirSync(tableDir, { recursive: true })
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(join(outputDir, 'previous.json'), '{"version":"previous"}', 'utf8')
  for (const locale of GAME_I18N_LOCALES) {
    writeFileSync(
      join(tableDir, `I18nTextTable_${GAME_I18N_UPSTREAM_SUFFIX[locale]}.json`),
      JSON.stringify({ '10001': locale }),
      'utf8',
    )
  }

  const renameWithInstallFailure: typeof renameSync = (source, destination) => {
    if (basename(String(source)).startsWith('.game-i18n-tmp-') && String(destination) === outputDir) {
      throw new Error('simulated install rename failure')
    }
    renameSync(source, destination)
  }
  const copyWithInstallFailure: typeof cpSync = (source, destination, options) => {
    if (basename(String(source)).startsWith('.game-i18n-tmp-')) {
      throw new Error('simulated install copy failure')
    }
    cpSync(source, destination, options)
  }

  try {
    expect(() =>
      exportGameI18nTables(akedata, outputDir, 1024, {
        cpSync: copyWithInstallFailure,
        existsSync,
        renameSync: renameWithInstallFailure,
        rmSync,
      }),
    ).toThrow('Failed to install game-i18n export')
    expect(readFileSync(join(outputDir, 'previous.json'), 'utf8')).toBe('{"version":"previous"}')
    expect(existsSync(join(outputDir, 'manifest.json'))).toBe(false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 15_000)
