import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseAkedataManifest,
  selectAkedataVersion,
  sanitizeVersionId,
  tableCfgUrl,
  mapsUrl,
  materializeTableCfg,
  materializeImageDb,
  hashMaps,
  GAME_I18N_SUFFIXES,
  MAPS_LOCALES,
  SYNC_TABLES,
} from './akedata-remote'

const manifestRaw = {
  schemaVersion: 1,
  latest: '1.6.4@11944529-13',
  versions: [
    {
      id: '1.6.4@11944529-13',
      gameVersion: '1.6.4',
      hotfixVersion: '11944529-13',
      tableCfgPath: 'public/1.6.4/11944529-13/TableCfg',
      publishedAt: '2026-11-21T19:33:07+08:00',
    },
    {
      id: '1.6.4@11775769-12',
      gameVersion: '1.6.4',
      hotfixVersion: '11775769-12',
      tableCfgPath: 'public/1.6.4/11775769-12/TableCfg',
      publishedAt: '2026-11-14T10:02:38+08:00',
    },
  ],
}

function fakeFetch(body: string | Record<string, string>) {
  const calls: string[] = []
  const fetchText = (url: string) => {
    calls.push(url)
    const key = Object.keys(body).find((name) => url.endsWith(name))
    if (typeof body !== 'string' && key) return Promise.resolve(body[key])
    if (typeof body === 'string') return Promise.resolve(body)
    return Promise.resolve('{}')
  }
  return { fetchText, calls }
}

describe('parseAkedataManifest', () => {
  it('keeps version metadata and the latest pointer', () => {
    const manifest = parseAkedataManifest(manifestRaw)
    expect(manifest.latest).toBe('1.6.4@11944529-13')
    expect(manifest.versions).toHaveLength(2)
    expect(manifest.versions[0]?.tableCfgPath).toBe('public/1.6.4/11944529-13/TableCfg')
    expect(manifest.versions[1]?.publishedAt).toBe('2026-11-14T10:02:38+08:00')
  })

  it('rejects a manifest whose latest is not listed', () => {
    expect(() => parseAkedataManifest({ ...manifestRaw, latest: '9.9.9@1-1' })).toThrow(/valid "latest"/)
    expect(() => parseAkedataManifest(null)).toThrow(/not an object/)
  })
})

describe('selectAkedataVersion', () => {
  const manifest = parseAkedataManifest(manifestRaw)

  it('defaults to latest and honours a pin', () => {
    expect(selectAkedataVersion(manifest).id).toBe('1.6.4@11944529-13')
    expect(selectAkedataVersion(manifest, '1.6.4@11775769-12').id).toBe('1.6.4@11775769-12')
  })

  it('fails loudly for an unknown pin', () => {
    expect(() => selectAkedataVersion(manifest, '0.0.1@1-1')).toThrow(/not found/)
  })
})

describe('urls', () => {
  const version = selectAkedataVersion(parseAkedataManifest(manifestRaw))

  it('joins the table path without doubling slashes', () => {
    expect(tableCfgUrl('https://data.akedata.wiki/', version, 'WeaponBasicTable'))
      .toBe('https://data.akedata.wiki/public/1.6.4/11944529-13/TableCfg/WeaponBasicTable.json')
  })

  it('points maps at the public AKEDatabase raw files', () => {
    expect(mapsUrl('CH')).toContain('/NagiYume/AKEDatabase/main/public/CH/maps.json')
  })

  it('sanitizes version ids for directory names', () => {
    expect(sanitizeVersionId('1.6.4@11944529-13')).toBe('1.6.4@11944529-13')
    expect(sanitizeVersionId('a/b')).toBe('a_b')
  })
})

describe('materializeTableCfg', () => {
  const version = selectAkedataVersion(parseAkedataManifest(manifestRaw))

  it('writes every table plus CN text in check mode and caches on the second run', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cep-akedata-'))
    try {
      const { fetchText, calls } = fakeFetch('{"ok":true}')
      const first = await materializeTableCfg({ version, destRoot: root, mode: 'check', fetchText })
      expect(first.downloaded).toHaveLength(SYNC_TABLES.length + 1)
      expect(calls).toHaveLength(SYNC_TABLES.length + 1)
      expect(existsSync(join(root, 'TableCfg', 'I18nTextTable_CN.json'))).toBe(true)
      expect(existsSync(join(root, 'TableCfg', 'I18nTextTable_EN.json'))).toBe(false)
      expect(readFileSync(join(root, 'TableCfg', 'WeaponBasicTable.json'), 'utf-8')).toBe('{"ok":true}')

      const second = await materializeTableCfg({ version, destRoot: root, mode: 'check', fetchText })
      expect(second.downloaded).toHaveLength(0)
      expect(second.skipped).toBe(SYNC_TABLES.length + 1)
      expect(calls).toHaveLength(SYNC_TABLES.length + 1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('downloads every exported locale in update mode', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cep-akedata-'))
    try {
      const { fetchText } = fakeFetch('{}')
      const result = await materializeTableCfg({ version, destRoot: root, mode: 'update', fetchText })
      expect(result.downloaded).toHaveLength(SYNC_TABLES.length + GAME_I18N_SUFFIXES.length)
      for (const suffix of GAME_I18N_SUFFIXES) {
        expect(existsSync(join(root, 'TableCfg', `I18nTextTable_${suffix}.json`))).toBe(true)
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects an HTML error page instead of caching it as a table', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cep-akedata-'))
    try {
      const { fetchText } = fakeFetch('<!DOCTYPE html><html></html>')
      await expect(materializeTableCfg({ version, destRoot: root, mode: 'check', fetchText }))
        .rejects.toThrow(/not JSON/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reports the failing table url when the host 404s', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cep-akedata-'))
    try {
      const fetchText = (url: string) => url.includes('GemTable')
        ? Promise.reject(new Error('HTTP 404'))
        : Promise.resolve('{}')
      await expect(materializeTableCfg({ version, destRoot: root, mode: 'check', fetchText }))
        .rejects.toThrow(/HTTP 404/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('materializeImageDb', () => {
  it('writes the four maps files and hashes their content', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cep-imagedb-'))
    try {
      const bodies = Object.fromEntries(MAPS_LOCALES.map((locale) => [`/${locale}/maps.json`, `{"ATTR_MAP":{"${locale}":"x"}}`]))
      const { fetchText } = fakeFetch(bodies)
      const result = await materializeImageDb({ destRoot: root, fetchText })
      expect(result.downloaded.sort()).toEqual([...MAPS_LOCALES].sort())
      expect(result.mapsHash).toMatch(/^maps-[0-9a-f]{12}$/)
      expect(hashMaps(root)).toBe(result.mapsHash)

      const before = result.mapsHash
      writeFileSync(join(root, 'public', 'CH', 'maps.json'), '{"ATTR_MAP":{"CH":"changed"}}', 'utf-8')
      expect(hashMaps(root)).not.toBe(before)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('skips existing files when caching', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cep-imagedb-'))
    try {
      mkdirSync(join(root, 'public', 'CH'), { recursive: true })
      for (const locale of MAPS_LOCALES) {
        mkdirSync(join(root, 'public', locale), { recursive: true })
        writeFileSync(join(root, 'public', locale, 'maps.json'), '{}', 'utf-8')
      }
      const { fetchText, calls } = fakeFetch('{}')
      const result = await materializeImageDb({ destRoot: root, fetchText })
      expect(result.downloaded).toHaveLength(0)
      expect(result.skipped).toBe(MAPS_LOCALES.length)
      expect(calls).toHaveLength(0)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
