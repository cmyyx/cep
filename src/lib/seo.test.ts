import { describe, expect, it } from 'vitest'
import { isSeoIndexableValue } from './seo'

describe('isSeoIndexableValue', () => {
  it('only enables indexing for the explicit production value', () => {
    expect(isSeoIndexableValue('true')).toBe(true)
    expect(isSeoIndexableValue('TRUE')).toBe(false)
    expect(isSeoIndexableValue('false')).toBe(false)
    expect(isSeoIndexableValue(undefined)).toBe(false)
    expect(isSeoIndexableValue('')).toBe(false)
  })
})
