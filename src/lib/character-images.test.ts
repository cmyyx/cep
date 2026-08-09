import { describe, expect, it } from 'vitest'
import { getCharacterAvatarPath } from './character-images'

describe('getCharacterAvatarPath', () => {
  it('resolves released character names to canonical IDs', () => {
    expect(getCharacterAvatarPath('佩丽卡')).toBe('/images/characters/chr_0004_pelica.avif')
  })

  it.each(['管理员', '管理员(男)', '管理员 (女)'])(
    'uses the canonical administrator avatar for %s',
    (name) => {
      expect(getCharacterAvatarPath(name)).toBe(
        '/images/characters/chr_9000_endmin.avif'
      )
    }
  )

  it('resolves the newest released character via the i18n name map', () => {
    expect(getCharacterAvatarPath('梨诺')).toBe('/images/characters/chr_0035_liino.avif')
  })

  it('does not invent paths for unknown characters', () => {
    expect(getCharacterAvatarPath('不存在')).toBeNull()
  })
})
