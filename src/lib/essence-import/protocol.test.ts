import { describe, expect, it } from 'vitest'
import { MAAEND_INVENTORY_FORMAT, MAAEND_PROTOCOL } from './protocol'

describe('MaaEND protocol baseline', () => {
  it('pins the version the parser implements', () => {
    // Bumping this means MaaEnd changed its schema: re-read
    // tools/schema/essence_inventory.schema.json and update maamend.ts first.
    expect(MAAEND_PROTOCOL.version).toBe(1)
  })

  it('records where the baseline came from', () => {
    expect(MAAEND_PROTOCOL.adaptedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(MAAEND_PROTOCOL.upstreamCommit).toMatch(/^[0-9a-f]{7,40}$/)
    expect(MAAEND_PROTOCOL.schemaUrl).toContain(MAAEND_PROTOCOL.schemaPath)
  })

  it('pins the schema fingerprint that the CI drift check compares against', () => {
    expect(MAAEND_PROTOCOL.schemaHash).toMatch(/^[0-9a-f]{64}$/)
    expect(MAAEND_INVENTORY_FORMAT).toBe('maaend.essence_inventory')
  })
})
