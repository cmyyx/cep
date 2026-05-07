import { describe, it, expect } from 'vitest'
import { dungeons } from './dungeons'

describe('dungeons data', () => {
  it('contains dungeons', () => {
    expect(dungeons.length).toBeGreaterThan(0)
  })

  it('every dungeon has a unique id', () => {
    const ids = dungeons.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every dungeon has required fields', () => {
    for (const d of dungeons) {
      expect(d.id).toBeTruthy()
      expect(d.name).toBeTruthy()
    }
  })

  it('every dungeon has non-empty s2Pool and s3Pool', () => {
    for (const d of dungeons) {
      expect(d.s2Pool.length).toBeGreaterThan(0)
      expect(d.s3Pool.length).toBeGreaterThan(0)
    }
  })

  it('s2Pool and s3Pool have no duplicate entries', () => {
    for (const d of dungeons) {
      expect(new Set(d.s2Pool).size).toBe(d.s2Pool.length)
      expect(new Set(d.s3Pool).size).toBe(d.s3Pool.length)
    }
  })
})
