import { describe, expect, it } from 'vitest'
import { detectImportKind } from './detect'
import { MAAEND_INVENTORY_FORMAT } from './protocol'

describe('detectImportKind', () => {
  it('detects a CEP export envelope', () => {
    expect(detectImportKind({ version: 1, modules: {} })).toBe('cep-backup')
    expect(detectImportKind({ version: 2, exportedAt: 'x', modules: { 'matrix-session': {} } })).toBe('cep-backup')
  })

  it('rejects objects that are not CEP exports', () => {
    expect(detectImportKind({})).toBeNull()
    expect(detectImportKind({ version: '1', modules: {} })).toBeNull()
    expect(detectImportKind({ version: 1 })).toBeNull()
    expect(detectImportKind({ version: 0, modules: {} })).toBeNull()
    expect(detectImportKind(null)).toBeNull()
    expect(detectImportKind('json')).toBeNull()
  })

  it('detects a MaaEND essence inventory by structural shape', () => {
    expect(detectImportKind([
      { weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [3, 2, 1], count: 2 }] },
    ])).toBe('maamend-essence')
    // An empty array is a valid MaaEND scan result ("nothing found").
    expect(detectImportKind([])).toBe('maamend-essence')
  })

  it('keeps malformed MaaEND-shaped arrays as MaaEND so the parser can explain the error', () => {
    expect(detectImportKind([{ weapon_ids: ['sword'], essences: [{ levels: [1, 1, 1], count: 1 }] }])).toBe('maamend-essence')
  })

  it('detects a protocol-v1 MaaEND inventory by its format marker', () => {
    expect(detectImportKind({
      format: MAAEND_INVENTORY_FORMAT,
      version: 1,
      updated_at: '2026-11-22T00:00:00Z',
      coverage: {},
      items: [],
    })).toBe('maamend-essence')
  })

  it('keeps a newer protocol version on the MaaEND path so the parser can explain it', () => {
    // Detection must not depend on `version`: a v2 file has to reach the parser,
    // otherwise the dialog falls back to "unrecognized file".
    expect(detectImportKind({ format: MAAEND_INVENTORY_FORMAT, version: 2 })).toBe('maamend-essence')
  })

  it('does not mistake a MaaEND inventory for a CEP backup', () => {
    expect(detectImportKind({ format: MAAEND_INVENTORY_FORMAT, version: 1, modules: {} })).toBe('maamend-essence')
  })

  it('rejects arrays that are not MaaEND-shaped', () => {
    expect(detectImportKind([{ weapon_ids: ['wpn_sword_0012'], essences: 'nope' }])).toBeNull()
    expect(detectImportKind([{ anything: true }])).toBeNull()
    expect(detectImportKind([1, 2, 3])).toBeNull()
    expect(detectImportKind(['a'])).toBeNull()
  })
})
