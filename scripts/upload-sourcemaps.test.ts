import { describe, expect, it } from 'vitest'
import { extractRelease } from './upload-sourcemaps.mjs'

describe('extractRelease', () => {
  it('uses the generated full version instead of the commit hash', () => {
    const source = `export const versionData = {
  "commit": "ea87444",
  "version": "1.2.0-ea87444"
}`

    expect(extractRelease(source)).toBe('1.2.0-ea87444')
  })

  it('fails when generated version data has no full version', () => {
    expect(() => extractRelease('export const versionData = { "commit": "ea87444" }')).toThrow(
      'could not extract version from version-data.ts',
    )
  })
})
