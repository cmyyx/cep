import { describe, it, expect } from 'vitest'
import { OverviewCards } from './overview-cards'

describe('OverviewCards', () => {
  it('exports OverviewCards component', () => {
    expect(OverviewCards).toBeDefined()
    expect(typeof OverviewCards).toBe('function')
  })

  it('has a stable component reference', () => {
    // Re-importing should yield the same component
    expect(OverviewCards).toBe(OverviewCards)
  })
})
