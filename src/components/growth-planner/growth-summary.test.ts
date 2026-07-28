import { describe, expect, it } from 'vitest'
import {
  GROWTH_MOBILE_RESOURCE_ROW_CLASS,
  GROWTH_MOBILE_STATS_CLASS,
} from './growth-summary'

describe('growth summary mobile layout', () => {
  it('uses an explicit icon and content grid', () => {
    expect(GROWTH_MOBILE_RESOURCE_ROW_CLASS).toContain('grid-cols-[2.5rem_minmax(0,1fr)]')
  })

  it('starts the farming stats at the image edge and fills the available row', () => {
    expect(GROWTH_MOBILE_STATS_CLASS).toContain('col-span-2')
    expect(GROWTH_MOBILE_STATS_CLASS).toContain('w-full')
    expect(GROWTH_MOBILE_STATS_CLASS).toContain('justify-between')
    expect(GROWTH_MOBILE_STATS_CLASS).not.toMatch(/\bml-/)
  })
})
