import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { assertSafeFileId, joinWithin } from './safe-path'

describe('assertSafeFileId', () => {
  it('accepts the slug ids used by the game tables', () => {
    expect(assertSafeFileId('wpn_funnel_0017')).toBe('wpn_funnel_0017')
    expect(assertSafeFileId('chr_0004_pelica')).toBe('chr_0004_pelica')
    expect(assertSafeFileId('item_equip_t4_suit_atb01_body_01')).toBe('item_equip_t4_suit_atb01_body_01')
  })

  it('rejects traversal and separator characters', () => {
    for (const id of ['../escape', 'a/b', 'a\\b', '', '.hidden', '..', './x']) {
      expect(() => assertSafeFileId(id)).toThrow(/Refusing unsafe/)
    }
  })
})

describe('joinWithin', () => {
  const base = join(process.cwd(), 'output')

  it('keeps ordinary file names inside the base directory', () => {
    expect(joinWithin(base, 'wpn_funnel_0017.json')).toBe(join(base, 'wpn_funnel_0017.json'))
  })

  it('refuses paths that resolve outside the base directory', () => {
    expect(() => joinWithin(base, '../escape.json')).toThrow(/Refusing path outside/)
    expect(() => joinWithin(base, '/etc/passwd')).toThrow(/Refusing path outside/)
  })
})
