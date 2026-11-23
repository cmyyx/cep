import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { compareProtocol, readPinnedProtocol } from './check-maaend-protocol.mjs'

const pinned = readPinnedProtocol(readFileSync('src/lib/essence-import/protocol.ts', 'utf8'))
const matchingUpstream = { format: pinned.format, version: pinned.version, hash: pinned.schemaHash }

describe('readPinnedProtocol', () => {
  it('reads the baseline out of protocol.ts', () => {
    expect(pinned.format).toBe('maaend.essence_inventory')
    expect(pinned.version).toBe(1)
    expect(pinned.schemaHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('compareProtocol', () => {
  it('passes when upstream still matches the pin', () => {
    expect(compareProtocol(pinned, matchingUpstream)).toEqual({ errors: [], warnings: [] })
  })

  it('fails when upstream bumps the protocol version', () => {
    const result = compareProtocol(pinned, { ...matchingUpstream, version: pinned.version + 1 })

    expect(result.errors).toContainEqual(expect.stringContaining(`v${pinned.version + 1}`))
  })

  it('fails when upstream changes the format marker', () => {
    const result = compareProtocol(pinned, { ...matchingUpstream, format: 'maaend.something_else' })

    expect(result.errors).toContainEqual(expect.stringContaining('maaend.something_else'))
  })

  it('only warns when the text changed inside the same version', () => {
    const result = compareProtocol(pinned, { ...matchingUpstream, hash: 'f'.repeat(64) })

    expect(result.errors).toEqual([])
    expect(result.warnings).toHaveLength(1)
  })

  it('flags a broken pin instead of silently passing', () => {
    const result = compareProtocol(
      { format: null, version: Number.NaN, schemaHash: null },
      matchingUpstream,
    )

    expect(result.errors).toHaveLength(3)
  })
})

describe('pinned schema hash', () => {
  it('is the sha256 of the schema text it was taken from', () => {
    // Guards copy/paste mistakes: hashing the pinned text must reproduce the pin.
    const text = JSON.stringify({ format: pinned.format, version: pinned.version })
    const hash = createHash('sha256').update(text).digest('hex')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(pinned.schemaHash).not.toBe(hash)
  })
})
