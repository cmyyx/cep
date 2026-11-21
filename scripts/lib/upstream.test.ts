import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveUpstreamSource, validatePaths } from './upstream'

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
