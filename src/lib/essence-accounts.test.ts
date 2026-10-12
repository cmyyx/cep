import { describe, expect, it } from 'vitest'
import {
  accountEntryCounts,
  clampAccountName,
  MAX_ACCOUNTS,
  sanitizeCloudAccounts,
} from './essence-accounts'

describe('sanitizeCloudAccounts', () => {
  it('filters invalid entries, resolves preview ids, and drops unknown weapon ids', () => {
    const accounts = sanitizeCloudAccounts([
      {
        id: 'acc_1',
        name: '主号',
        weaponOwnership: { wpn_claym_0017: true, 'preview:雾中微光': true, unknown_weapon: true, bad_value: 'yes' },
        essenceStatus: { wpn_claym_0017: false },
        weaponNotes: { wpn_claym_0017: 'note', unknown_weapon: 'x' },
      },
      null,
      'garbage',
    ])
    expect(accounts.length).toBe(1)
    expect(accounts[0].name).toBe('主号')
    // preview id resolves through resolveWeaponIdKeys; unknown ids are dropped
    expect(accounts[0].weaponOwnership['wpn_claym_0017']).toBe(true)
    expect(accounts[0].weaponOwnership['preview:雾中微光']).toBeUndefined()
    expect(accounts[0].weaponOwnership['unknown_weapon']).toBeUndefined()
    expect(accounts[0].essenceStatus['wpn_claym_0017']).toBe(false)
    expect(accounts[0].weaponNotes['wpn_claym_0017']).toBe('note')
    expect(accounts[0].weaponNotes['unknown_weapon']).toBeUndefined()
  })

  it('generates ids for entries without one and trims over-long names', () => {
    const accounts = sanitizeCloudAccounts([
      { name: 'x'.repeat(80), weaponOwnership: {}, essenceStatus: {}, weaponNotes: {} },
    ])
    expect(accounts.length).toBe(1)
    expect(accounts[0].id.startsWith('acc_')).toBe(true)
    expect(accounts[0].name.length).toBe(50)
  })

  it('keeps a valid weapon selection and drops junk ids', () => {
    const accounts = sanitizeCloudAccounts([
      {
        id: 'acc_1',
        name: '主号',
        selectedWeaponIds: ['wpn_claym_0017', 'wpn_claym_0017', 'unknown_weapon', 7, null, 'wpn_sword_0012'],
      },
    ])
    // Deduplicated, unknown ids dropped, order normalized.
    expect(accounts[0].selectedWeaponIds).toEqual(['wpn_claym_0017', 'wpn_sword_0012'])
  })

  it('defaults the selection to an empty list when the field is missing or corrupt', () => {
    const accounts = sanitizeCloudAccounts([
      { id: 'acc_1', name: '主号' },
      { id: 'acc_2', name: '小号', selectedWeaponIds: 'nope' },
    ])
    expect(accounts[0].selectedWeaponIds).toEqual([])
    expect(accounts[1].selectedWeaponIds).toEqual([])
  })

  it('caps the account list at MAX_ACCOUNTS', () => {
    const many = Array.from({ length: MAX_ACCOUNTS + 5 }, (_, i) => ({
      id: `acc_${i}`,
      name: `A${i}`,
      weaponOwnership: {},
      essenceStatus: {},
      weaponNotes: {},
    }))
    const accounts = sanitizeCloudAccounts(many)
    expect(accounts.length).toBe(MAX_ACCOUNTS)
  })

  it('returns an empty array for non-array input', () => {
    expect(sanitizeCloudAccounts(null)).toEqual([])
    expect(sanitizeCloudAccounts({})).toEqual([])
    expect(sanitizeCloudAccounts('x')).toEqual([])
  })
})

describe('accountEntryCounts', () => {
  it('sums mark entries across accounts', () => {
    const counts = accountEntryCounts([
      { id: 'a', name: 'A', weaponOwnership: { wpn_claym_0017: true }, essenceStatus: {}, weaponNotes: { wpn_claym_0017: 'x' }, selectedWeaponIds: [] },
      { id: 'b', name: 'B', weaponOwnership: { wpn_funnel_0001: true, wpn_lance_0003: true }, essenceStatus: { wpn_funnel_0001: true }, weaponNotes: {}, selectedWeaponIds: [] },
    ])
    expect(counts).toEqual({ ownership: 3, essence: 1, notes: 1 })
  })
})

describe('clampAccountName', () => {
  it('trims names to the backend limit', () => {
    expect(clampAccountName('short')).toBe('short')
    expect(clampAccountName('x'.repeat(120)).length).toBe(50)
  })
})
