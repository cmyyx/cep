export const PLANNER_RESOURCES = {
  stageOneExp: {
    itemId: 'item_expcard_stage1_high',
    iconId: 'item_expcard_2_3',
  },
  stageTwoExp: {
    itemId: 'item_expcard_stage2_high',
    iconId: 'item_expcard_stage2_high',
  },
  weaponExp: {
    itemId: 'item_weapon_expcard_high',
    iconId: 'item_weapon_expcard_high',
  },
  gold: {
    itemId: 'item_gold',
    iconId: 'item_gold',
  },
} as const

export const PLANNER_RESOURCE_IDS = {
  stageOneExp: PLANNER_RESOURCES.stageOneExp.itemId,
  stageTwoExp: PLANNER_RESOURCES.stageTwoExp.itemId,
  weaponExp: PLANNER_RESOURCES.weaponExp.itemId,
  gold: PLANNER_RESOURCES.gold.itemId,
} as const

export const PLANNER_RESOURCE_ICON_IDS = Object.values(PLANNER_RESOURCES).map((resource) => resource.iconId)
