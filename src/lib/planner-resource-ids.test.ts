import { expect, it } from 'vitest'
import { PLANNER_RESOURCE_IDS, PLANNER_RESOURCES } from './planner-resource-ids'

it('keeps the stage-one EXP item ID distinct from its icon ID', () => {
  expect(PLANNER_RESOURCE_IDS.stageOneExp).toBe('item_expcard_stage1_high')
  expect(PLANNER_RESOURCES.stageOneExp.iconId).toBe('item_expcard_2_3')
})
