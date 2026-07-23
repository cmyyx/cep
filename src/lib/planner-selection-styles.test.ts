import { expect, it } from 'vitest'
import { PLANNER_SELECTED_BADGE_CLASS, PLANNER_SELECTED_RING_CLASS } from './planner-selection-styles'

it('exports the shared planner selection style tokens', () => {
  expect(PLANNER_SELECTED_RING_CLASS).toBe('ring-2 ring-amber-400/50 ring-offset-2 ring-offset-background')
  expect(PLANNER_SELECTED_BADGE_CLASS).toBe('bg-amber-400 text-black')
})
