import { describe, it, expect } from 'vitest'
import { MATERIAL_NAMES } from './material-names'

describe('MATERIAL_NAMES', () => {
  it('is a Set', () => {
    expect(MATERIAL_NAMES).toBeInstanceOf(Set)
  })

  it('contains known sample entries', () => {
    expect(MATERIAL_NAMES.has('D96钢样品四')).toBe(true)
    expect(MATERIAL_NAMES.has('协议圆盘')).toBe(true)
    expect(MATERIAL_NAMES.has('高级认知载体')).toBe(true)
  })

  it('has the expected size', () => {
    expect(MATERIAL_NAMES.size).toBe(51)
  })

  it('does not contain an unrelated name', () => {
    expect(MATERIAL_NAMES.has('不存在的材料名称XYZ')).toBe(false)
  })
})
