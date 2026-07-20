import { expect, it } from 'vitest'
import { splitPlannerRecipes } from './equip-card'
import type { WikiCraftingRecipe } from '@/types/wiki'

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
