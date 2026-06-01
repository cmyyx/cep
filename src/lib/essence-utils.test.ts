import { describe, it, expect } from 'vitest'
import { dungeons } from '@/data/dungeons'
import {
  ALL_PRIMARY_STATS,
  ALL_ELEMENTAL_DAMAGE,
  ALL_SPECIAL_ABILITIES,
} from './essence-utils'

describe('essence-utils ALL_* constants', () => {
  it('ALL_PRIMARY_STATS equals deduplicated sorted s1Pool from dungeons', () => {
    const expected = [...new Set(dungeons.flatMap((d) => d.s1Pool))].sort()
    expect(ALL_PRIMARY_STATS).toEqual(expected)
  })

  it('ALL_ELEMENTAL_DAMAGE equals deduplicated sorted s2Pool from dungeons', () => {
    const expected = [...new Set(dungeons.flatMap((d) => d.s2Pool))].sort()
    expect(ALL_ELEMENTAL_DAMAGE).toEqual(expected)
  })

  it('ALL_SPECIAL_ABILITIES equals deduplicated sorted s3Pool from dungeons', () => {
    const expected = [...new Set(dungeons.flatMap((d) => d.s3Pool))].sort()
    expect(ALL_SPECIAL_ABILITIES).toEqual(expected)
  })

  it('ALL_PRIMARY_STATS has no duplicates', () => {
    expect(new Set(ALL_PRIMARY_STATS).size).toBe(ALL_PRIMARY_STATS.length)
  })

  it('ALL_ELEMENTAL_DAMAGE has no duplicates', () => {
    expect(new Set(ALL_ELEMENTAL_DAMAGE).size).toBe(ALL_ELEMENTAL_DAMAGE.length)
  })

  it('ALL_SPECIAL_ABILITIES has no duplicates', () => {
    expect(new Set(ALL_SPECIAL_ABILITIES).size).toBe(ALL_SPECIAL_ABILITIES.length)
  })

  it('ALL_PRIMARY_STATS is sorted', () => {
    expect(ALL_PRIMARY_STATS).toEqual([...ALL_PRIMARY_STATS].sort())
  })

  it('ALL_ELEMENTAL_DAMAGE is sorted', () => {
    expect(ALL_ELEMENTAL_DAMAGE).toEqual([...ALL_ELEMENTAL_DAMAGE].sort())
  })

  it('ALL_SPECIAL_ABILITIES is sorted', () => {
    expect(ALL_SPECIAL_ABILITIES).toEqual([...ALL_SPECIAL_ABILITIES].sort())
  })
})
