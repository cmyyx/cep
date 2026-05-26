import { describe, it, expect } from 'vitest'
import {
  isWeaponNameValid,
  isEquipNameValid,
  isMaterialNameValid,
} from './validate-editor-names'

describe('isWeaponNameValid', () => {
  it('returns true for empty string', () => {
    expect(isWeaponNameValid('')).toBe(true)
  })

  it('returns true for whitespace-only input (trimmed → empty)', () => {
    expect(isWeaponNameValid('   ')).toBe(true)
  })

  it('returns true for a known weapon name with surrounding spaces', () => {
    expect(isWeaponNameValid('  雾中微光  ')).toBe(true)
  })

  it('returns true for a known weapon name', () => {
    expect(isWeaponNameValid('雾中微光')).toBe(true)
  })

  it('returns false for an unknown name', () => {
    expect(isWeaponNameValid('不存在的武器名称XYZ123')).toBe(false)
  })
})

describe('isEquipNameValid', () => {
  it('returns true for empty string', () => {
    expect(isEquipNameValid('')).toBe(true)
  })

  it('returns true for a known equip name with surrounding spaces', () => {
    expect(isEquipNameValid('  长息辅助臂  ')).toBe(true)
  })

  it('returns true for a known equip name', () => {
    expect(isEquipNameValid('长息辅助臂')).toBe(true)
  })

  it('returns false for an unknown name', () => {
    expect(isEquipNameValid('不存在的装备名称XYZ123')).toBe(false)
  })
})

describe('isMaterialNameValid', () => {
  it('returns true for empty string', () => {
    expect(isMaterialNameValid('')).toBe(true)
  })

  it('returns true for a known material name', () => {
    expect(isMaterialNameValid('协议圆盘')).toBe(true)
  })

  it('returns true for a material name with quantity suffix', () => {
    expect(isMaterialNameValid('协议圆盘 x20')).toBe(true)
  })

  it('returns true for a material name with "x1.6k" suffix', () => {
    expect(isMaterialNameValid('折金票 x1.6k')).toBe(true)
  })

  it('returns false for a completely unknown name', () => {
    expect(isMaterialNameValid('不存在的材料名称XYZ123')).toBe(false)
  })
})
