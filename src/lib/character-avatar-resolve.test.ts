import { describe, expect, it } from 'vitest'
import {
  buildCharacterIdByName,
  createCharacterAvatarResolver,
  resolveAdministratorAssetId,
} from './character-avatar-resolve'

const lookup = {
  characterNames: {
    chr_0002_endminm: '管理员 (男)',
    chr_0003_endminf: '管理员 (女)',
    chr_0004_pelica: '佩丽卡',
    chr_0035_liino: '梨诺',
    chr_9000_endmin: '管理员',
    chr_0039_untranslated: 'chr_0039_untranslated',
  },
  previewAvatars: { 祀: 'preview-2201' },
}

describe('buildCharacterIdByName', () => {
  it('keeps released characters and drops deprecated, administrator and untranslated entries', () => {
    expect([...buildCharacterIdByName(lookup.characterNames)]).toEqual([
      ['佩丽卡', 'chr_0004_pelica'],
      ['梨诺', 'chr_0035_liino'],
    ])
  })
})

describe('resolveAdministratorAssetId', () => {
  it.each([
    ['管理员', 'chr_9000_endmin-female'],
    ['管理员(女)', 'chr_9000_endmin-female'],
    ['管理员 (女)', 'chr_9000_endmin-female'],
    ['管理员(男)', 'chr_9000_endmin-male'],
    ['管理员 (男)', 'chr_9000_endmin-male'],
  ])('maps %s to %s', (name, expected) => {
    expect(resolveAdministratorAssetId(name)).toBe(expected)
  })

  it('ignores non-administrator names', () => {
    expect(resolveAdministratorAssetId('佩丽卡')).toBeNull()
  })
})

describe('createCharacterAvatarResolver', () => {
  const resolver = createCharacterAvatarResolver(lookup)

  it('prefers the administrator mapping over the i18n table', () => {
    expect(resolver.resolve('管理员')).toBe('chr_9000_endmin-female')
  })

  it('resolves released characters from the i18n table', () => {
    expect(resolver.resolve('梨诺')).toBe('chr_0035_liino')
  })

  it('falls back to the Skland preview manifest for unreleased characters', () => {
    expect(resolver.resolve('祀')).toBe('preview-2201')
  })

  it('trims surrounding whitespace before resolving', () => {
    expect(resolver.resolve('  佩丽卡 ')).toBe('chr_0004_pelica')
  })

  it('returns null for names that are neither released nor previewed', () => {
    expect(resolver.resolve('明河')).toBeNull()
  })
})
