import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isLocalSource, resolveUpstreamSource, validatePaths } from './upstream'
import { hashMaps, MAPS_LOCALES } from './akedata-remote'

function tempAkedata(withTableCfg: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), 'cep-upstream-'))
  if (withTableCfg) mkdirSync(join(dir, 'TableCfg'), { recursive: true })
  return dir
}

describe('validatePaths', () => {
  it('accepts a data tree that only carries TableCfg', () => {
    const akedata = tempAkedata(true)
    try {
      expect(validatePaths({ akedata, imagedb: akedata })).toEqual([])
    } finally {
      rmSync(akedata, { recursive: true, force: true })
    }
  })

  it('reports a missing tree or a tree without TableCfg', () => {
    const empty = tempAkedata(false)
    try {
      expect(validatePaths({ akedata: join(empty, 'nope'), imagedb: empty })[0]).toMatch(/path not found/)
      expect(validatePaths({ akedata: empty, imagedb: empty })[0]).toMatch(/missing expected subdirectory "TableCfg"/)
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})

describe('isLocalSource', () => {
  it('treats an explicit checkout and --local the same way', () => {
    expect(isLocalSource({ paths: { akedata: '/tmp/a', imagedb: '/tmp/b' }, remote: null }, false)).toBe(true)
    expect(isLocalSource({
      paths: { akedata: '/tmp/a', imagedb: '/tmp/b' },
      remote: { version: '1.6.4@1-1', publishedAt: '', mapsHash: 'maps-x' },
    }, true)).toBe(true)
    expect(isLocalSource({
      paths: { akedata: '/tmp/a', imagedb: '/tmp/b' },
      remote: { version: '1.6.4@1-1', publishedAt: '', mapsHash: 'maps-x' },
    }, false)).toBe(false)
  })
})

describe('resolveUpstreamSource', () => {
  it('uses an explicit local checkout without touching the network', async () => {
    const akedata = tempAkedata(true)
    const imagedb = mkdtempSync(join(tmpdir(), 'cep-imagedb-'))
    try {
      const source = await resolveUpstreamSource(
        { akedata, imagedb },
        { mode: 'check', local: false },
      )
      expect(source.paths).toEqual({ akedata, imagedb })
      expect(source.remote).toBeNull()
    } finally {
      rmSync(akedata, { recursive: true, force: true })
      rmSync(imagedb, { recursive: true, force: true })
    }
  })

  it('materializes tables from the manifest and honours an explicit imagedb path', async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), 'cep-cache-'))
    const imagedb = mkdtempSync(join(tmpdir(), 'cep-maps-'))
    try {
      for (const locale of MAPS_LOCALES) {
        mkdirSync(join(imagedb, 'public', locale), { recursive: true })
        writeFileSync(join(imagedb, 'public', locale, 'maps.json'), '{"ATTR_MAP":{}}', 'utf8')
      }
      const manifest = JSON.stringify({
        schemaVersion: 1,
        latest: '1.6.4@11944529-13',
        versions: [{
          id: '1.6.4@11944529-13',
          gameVersion: '1.6.4',
          hotfixVersion: '11944529-13',
          tableCfgPath: 'public/1.6.4/11944529-13/TableCfg',
          publishedAt: '2026-11-21T19:33:07+08:00',
        }],
      })
      const fetchText = (url: string) => Promise.resolve(url.endsWith('/manifest.json') ? manifest : '{}')

      const source = await resolveUpstreamSource(
        { imagedb },
        { mode: 'check', local: false, cacheRoot, fetchText },
      )

      expect(source.remote?.version).toBe('1.6.4@11944529-13')
      expect(source.paths.akedata).toBe(join(cacheRoot, 'akedata', '1.6.4@11944529-13'))
      expect(source.paths.imagedb).toBe(imagedb)
      expect(source.remote?.mapsHash).toBe(hashMaps(imagedb))
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true })
      rmSync(imagedb, { recursive: true, force: true })
    }
  })

  it('fails with a migration hint when the local checkout is incomplete', async () => {
    const empty = tempAkedata(false)
    try {
      await expect(resolveUpstreamSource({ akedata: empty }, { mode: 'check', local: true }))
        .rejects.toThrow(/Drop --local/)
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})
