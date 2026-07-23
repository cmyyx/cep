import { describe, expect, it } from 'vitest'
import { wikiTextKey } from './wiki-i18n'

describe('wikiTextKey', () => {
  it('encodes dots inside source IDs so next-intl treats the key as flat', () => {
    expect(wikiTextKey('glossary', 'ba.consume', 'name')).toBe('glossary|ba%2Econsume|name')
  })

  it('leaves ordinary generated IDs unchanged', () => {
    expect(wikiTextKey('weapon', 'wpn_claym_0003', 'skill', 1)).toBe('weapon|wpn_claym_0003|skill|1')
  })
})
