import { describe, expect, it } from 'vitest'
import { getCharacterAvatarPath, getCharacterId } from './character-images'

describe('getCharacterAvatarPath', () => {
  it('resolves released character names to canonical IDs', () => {
    expect(getCharacterAvatarPath('佩丽卡')).toBe('/images/characters/chr_0004_pelica.avif')
  })

  it.each(['管理员', '管理员(女)', '管理员 (女)'])(
    'uses the female administrator avatar as default for %s',
    (name) => {
      expect(getCharacterAvatarPath(name)).toBe(
        '/images/characters/chr_9000_endmin-female.avif'
      )
    }
  )

  it.each(['管理员(男)', '管理员 (男)'])(
    'uses the male administrator avatar for %s',
    (name) => {
      expect(getCharacterAvatarPath(name)).toBe(
        '/images/characters/chr_9000_endmin-male.avif'
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

describe('getCharacterId', () => {
  it('maps a zh-CN name to the game i18n id used for localized labels', () => {
    expect(getCharacterId('佩丽卡')).toBe('chr_0004_pelica')
    expect(getCharacterId('洛茜')).toBe('chr_0028_wulfa')
  })

  it.each(['管理员', '管理员(女)', '管理员 (女)', '管理员(男)'])(
    'maps every administrator variant onto the single administrator entry: %s',
    (name) => {
      expect(getCharacterId(name)).toBe('chr_9000_endmin')
    }
  )

  it('returns null for names with no game entry (preview / custom names)', () => {
    expect(getCharacterId('不存在')).toBeNull()
    // 不要拿真实的前瞻角色名当反例：上游一旦实装（2026-11 的「明河」就是这样），
    // 这条断言会从“无收录”变成“有收录”而误报。用不可能存在的名字。
    expect(getCharacterId('未实装的测试角色')).toBeNull()
  })
})
