import { describe, expect, it } from 'vitest'
import { isDevBuildValue } from './build-flags'

describe('isDevBuildValue', () => {
  it('only enables the dev notice for the explicit true value', () => {
    expect(isDevBuildValue('true')).toBe(true)
    expect(isDevBuildValue('false')).toBe(false)
    expect(isDevBuildValue(undefined)).toBe(false)
    expect(isDevBuildValue('1')).toBe(false)
  })
})
