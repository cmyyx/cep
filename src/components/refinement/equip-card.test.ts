import { expect, it } from 'vitest'
import { getPlannerStatPreview, splitPlannerRecipes } from './equip-card'
import type { WikiCraftingRecipe } from '@/types/wiki'
import type { Equip } from '@/types/refinement'
import type { WikiEquipmentPlannerPreview } from '@/types/wiki'

const recipe = (chainId: number, isDefault: boolean, discount: number): WikiCraftingRecipe => ({
  chainId,
  isDefault,
  discount,
  materials: [],
})

it('shows default and discounted recipes before collapsing ordinary alternatives', () => {
  const defaultRecipe = recipe(1, true, 1)
  const ordinaryRecipe = recipe(2, false, 1)
  const discountedRecipe = recipe(3, false, 0.01)

  expect(splitPlannerRecipes([ordinaryRecipe, discountedRecipe, defaultRecipe])).toEqual({
    featured: [defaultRecipe, discountedRecipe],
    other: [ordinaryRecipe],
  })
})

it('uses slot order when an equipment repeats the same attribute ID', () => {
  const sub = { key: 'Sub', value: 55, unit: '', display: 'Sub+55' }
  const special = { key: 'Sub', value: 14.75, unit: '%', display: 'Sub+14.75%' }
  const equip = { sub1: sub, sub2: null, special } satisfies Pick<Equip, 'sub1' | 'sub2' | 'special'>
  const preview = {
    stats: [
      { attributeId: '3', levelOne: '42', maxLevel: '42', levelOneLabel: '+0', maxLevelLabel: '+3' },
      { attributeId: 'Sub', levelOne: '55', maxLevel: '71', levelOneLabel: '+0', maxLevelLabel: '+3' },
      { attributeId: 'Sub', levelOne: '14.75%', maxLevel: '19.18%', levelOneLabel: '+0', maxLevelLabel: '+3' },
    ],
    craftingRecipes: [],
  } satisfies WikiEquipmentPlannerPreview

  expect(getPlannerStatPreview(equip, preview, 'sub1')).toEqual({ levelOne: '55', maxLevel: '71' })
  expect(getPlannerStatPreview(equip, preview, 'special')).toEqual({ levelOne: '14.75%', maxLevel: '19.18%' })
})
