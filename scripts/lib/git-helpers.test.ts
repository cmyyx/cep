import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readUpstreamVersions, upstreamVersionsMatch, writeUpstreamVersions } from './git-helpers'

const VERSIONS = join('scripts', '.cache', 'upstream-versions.json')

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'cep-versions-'))
}

function writeVersionsFile(root: string, payload: unknown): void {
  mkdirSync(join(root, 'scripts', '.cache'), { recursive: true })
  writeFileSync(join(root, VERSIONS), JSON.stringify(payload), 'utf-8')
}

describe('upstreamVersionsMatch', () => {
  const current = { version: '1.6.4@11944529-13', mapsHash: 'maps-aaaa11112222' }

  it('requires both the version id and the maps hash to match', () => {
    expect(upstreamVersionsMatch({
      schemaVersion: 2,
      akedata: null,
      akedataVersion: current.version,
      akedataPublishedAt: '2026-11-21T19:33:07+08:00',
      imagedbMapsHash: current.mapsHash,
      lastSync: null,
    }, current)).toBe(true)

    expect(upstreamVersionsMatch({
      schemaVersion: 2,
      akedata: null,
      akedataVersion: '1.6.4@11775769-12',
      akedataPublishedAt: null,
      imagedbMapsHash: current.mapsHash,
      lastSync: null,
    }, current)).toBe(false)

    expect(upstreamVersionsMatch({
      schemaVersion: 2,
      akedata: null,
      akedataVersion: current.version,
      akedataPublishedAt: null,
      imagedbMapsHash: 'maps-stale',
      lastSync: null,
    }, current)).toBe(false)
  })

  it('never matches a legacy (v1) snapshot', () => {
    expect(upstreamVersionsMatch({
      schemaVersion: 1,
      akedata: '2f74a1123f2e',
      akedataVersion: null,
      akedataPublishedAt: null,
      imagedbMapsHash: null,
      lastSync: null,
    }, current)).toBe(false)
  })
})

describe('readUpstreamVersions', () => {
  it('returns an empty snapshot when the file is missing or malformed', () => {
    const root = tempRoot()
    try {
      expect(readUpstreamVersions(root).akedataVersion).toBeNull()
      writeVersionsFile(root, '{not json')
      expect(readUpstreamVersions(root).akedataVersion).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reads v2 fields and keeps the legacy SHA of v1 files', () => {
    const root = tempRoot()
    try {
      writeVersionsFile(root, {
        schemaVersion: 2,
        akedataVersion: '1.6.4@11944529-13',
        akedataPublishedAt: '2026-11-21T19:33:07+08:00',
        imagedbMapsHash: 'maps-aaaa11112222',
        lastSync: '2026-11-22T00:00:00.000Z',
      })
      const v2 = readUpstreamVersions(root)
      expect(v2.schemaVersion).toBe(2)
      expect(v2.akedataVersion).toBe('1.6.4@11944529-13')
      expect(v2.imagedbMapsHash).toBe('maps-aaaa11112222')

      writeVersionsFile(root, { akedata: '2f74a1123f2e', imagedb: 'f3a5f76cd3c4', lastSync: null })
      const v1 = readUpstreamVersions(root)
      expect(v1.schemaVersion).toBe(1)
      expect(v1.akedata).toBe('2f74a1123f2e')
      expect(v1.akedataVersion).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('writeUpstreamVersions', () => {
  it('writes a v2 payload without SHAs and clears the legacy field', () => {
    const root = tempRoot()
    try {
      writeUpstreamVersions({
        version: '1.6.4@11944529-13',
        publishedAt: '2026-11-21T19:33:07+08:00',
        mapsHash: 'maps-aaaa11112222',
      }, root)
      const raw = JSON.parse(readFileSync(join(root, VERSIONS), 'utf-8')) as Record<string, unknown>
      expect(raw.schemaVersion).toBe(2)
      expect(raw.akedataVersion).toBe('1.6.4@11944529-13')
      expect(raw.akedata).toBeNull()
      expect(raw.imagedbMapsHash).toBe('maps-aaaa11112222')
      expect(typeof raw.lastSync).toBe('string')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
