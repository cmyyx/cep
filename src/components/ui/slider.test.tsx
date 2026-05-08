import { describe, it, expect } from 'vitest'
import { Slider } from './slider'

describe('Slider', () => {
  it('exports Slider component', () => {
    expect(Slider).toBeDefined()
    expect(typeof Slider).toBe('object')
  })

  it('has displayName set', () => {
    expect(Slider.displayName).toBeDefined()
  })
})
