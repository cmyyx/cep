import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  compareProtocol,
  isTransientHttpStatus,
  readPinnedProtocol,
  type UpstreamProtocol,
} from './lib/maaend-protocol'

const pinned = readPinnedProtocol(readFileSync('src/lib/essence-import/protocol.ts', 'utf8'))
const matchingUpstream: UpstreamProtocol = {
  format: pinned.format,
  version: pinned.version,
  hash: pinned.schemaHash ?? undefined,
}

describe('readPinnedProtocol', () => {
  it('reads the baseline out of protocol.ts', () => {
    expect(pinned.format).toBe('maaend.essence_inventory')
    expect(pinned.version).toBe(1)
    expect(pinned.schemaHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('isTransientHttpStatus', () => {
  // A moved/deleted schema must fail the gate instead of looking like flaky network
  it('treats moved or removed schema as drift, not as a network skip', () => {
    expect(isTransientHttpStatus(404)).toBe(false)
    expect(isTransientHttpStatus(410)).toBe(false)
    expect(isTransientHttpStatus(403)).toBe(false)
  })

  it('treats rate limits and server errors as transient', () => {
    expect(isTransientHttpStatus(429)).toBe(true)
    expect(isTransientHttpStatus(500)).toBe(true)
    expect(isTransientHttpStatus(503)).toBe(true)
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

  // A removed/moved marker used to be skipped silently, so the gate printed OK
  it('fails when upstream stops publishing the format marker', () => {
    const result = compareProtocol(pinned, { ...matchingUpstream, format: undefined })

    expect(result.errors).toContainEqual(expect.stringContaining('format'))
  })

  it('fails when upstream stops publishing the version marker', () => {
    const result = compareProtocol(pinned, { ...matchingUpstream, version: undefined })

    expect(result.errors).toContainEqual(expect.stringContaining('version'))
  })

  it('flags a malformed upstream version instead of skipping the comparison', () => {
    const result = compareProtocol(pinned, { ...matchingUpstream, version: '1' })

    expect(result.errors).toContainEqual(expect.stringContaining('version'))
  })

  it('flags a broken pin instead of silently passing', () => {
    const result = compareProtocol({ format: null, version: Number.NaN, schemaHash: null }, matchingUpstream)

    expect(result.errors).toHaveLength(3)
  })
})
