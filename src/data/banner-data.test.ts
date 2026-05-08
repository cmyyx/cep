import { describe, it, expect } from 'vitest'
import { bannerSchedule, standardCharacters } from './banner-data'

describe('banner-data', () => {
  it('bannerSchedule has entries', () => {
    expect(Object.keys(bannerSchedule).length).toBeGreaterThan(0)
  })

  it('every character has non-empty windows', () => {
    for (const data of Object.values(bannerSchedule)) {
      expect(data.windows.length).toBeGreaterThan(0)
    }
  })

  it('every window has start and end strings', () => {
    for (const data of Object.values(bannerSchedule)) {
      for (const w of data.windows) {
        expect(w.start).toBeTruthy()
        expect(w.end).toBeTruthy()
        expect(typeof w.start).toBe('string')
        expect(typeof w.end).toBe('string')
      }
    }
  })

  it('main UP windows have period set', () => {
    for (const data of Object.values(bannerSchedule)) {
      for (const w of data.windows) {
        if (!w.isRerun) {
          expect(w.period).toBeDefined()
          expect(w.period).toBeGreaterThan(0)
        }
      }
    }
  })

  it('standardCharacters is non-empty', () => {
    expect(standardCharacters.length).toBeGreaterThan(0)
  })
})
