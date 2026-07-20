import { expect, it } from 'vitest'
import { upstreamVersionsMatch } from './git-helpers'

it('matches only when both upstream repository SHAs are current', () => {
  expect(upstreamVersionsMatch(
    { akedata: 'data-sha', imagedb: 'image-sha', lastSync: null },
    { akedata: 'data-sha', imagedb: 'image-sha' }
  )).toBe(true)
  expect(upstreamVersionsMatch(
    { akedata: 'data-sha', imagedb: 'old-image-sha', lastSync: null },
    { akedata: 'data-sha', imagedb: 'image-sha' }
  )).toBe(false)
  expect(upstreamVersionsMatch(
    { akedata: 'data-sha', imagedb: null, lastSync: null },
    { akedata: 'data-sha', imagedb: 'image-sha' }
  )).toBe(false)
})
