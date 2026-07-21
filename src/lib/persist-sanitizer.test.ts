import { expect, it } from 'vitest'
import { sanitizeCustomWeapons } from './persist-sanitizer'

const wildcardWeapon = {
  id: 'custom-wildcard',
  name: '通配武器',
  rarity: 3,
  type: '单手剑',
  primaryStat: null,
  elementalDamage: 'atk',
  specialAbility: null,
  chars: [],
} as const

it('preserves null wildcard slots through persisted JSON', () => {
  const persisted = JSON.parse(JSON.stringify([wildcardWeapon])) as unknown
  expect(sanitizeCustomWeapons(persisted)).toEqual([wildcardWeapon])
})

it('drops malformed custom weapon payloads at import boundaries', () => {
  expect(sanitizeCustomWeapons([
    wildcardWeapon,
    { ...wildcardWeapon, id: 'wpn_not_custom' },
    { ...wildcardWeapon, rarity: 2 },
    { ...wildcardWeapon, specialAbility: false },
  ])).toEqual([wildcardWeapon])
})
