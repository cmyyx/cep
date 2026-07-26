import { expect, it } from 'vitest'
import {
  EQUIP_TYPE_KEYS,
  matchesEquipQuery,
  refinementPartialize,
  sanitizeExpandedRecommendations,
  useRefinementStore,
} from './useRefinementStore'
import type { Equip } from '@/types/refinement'

const equip = { name: '50式应龙短刃·壹型', type: '配件', setName: '50式应龙' } satisfies Pick<
  Equip,
  'name' | 'type' | 'setName'
>

it('matches the raw zh-CN data', () => {
  expect(matchesEquipQuery(equip, '应龙')).toBe(true)
  expect(matchesEquipQuery(equip, '配件')).toBe(true)
  expect(matchesEquipQuery(equip, '  ')).toBe(true)
  expect(matchesEquipQuery(equip, 'yinglung')).toBe(false)
})

it('also matches the localized name, type and set label shown on the card', () => {
  const localized = { name: 'Type 50 Yinglung Dagger T1', type: 'Kit', setName: 'Type 50 Yinglung' }

  expect(matchesEquipQuery(equip, 'yinglung', localized)).toBe(true)
  expect(matchesEquipQuery(equip, 'KIT', localized)).toBe(true)
  expect(matchesEquipQuery(equip, 'dagger', localized)).toBe(true)
  expect(matchesEquipQuery(equip, 'gloves', localized)).toBe(false)
  expect(EQUIP_TYPE_KEYS['配件']).toBe('edc')
})

it('persists the recommendation expand state alongside the other user choices', () => {
  useRefinementStore.getState().toggleRecommendationExpand('equip-1:sub1')
  const persisted = refinementPartialize(useRefinementStore.getState())

  expect(Object.keys(persisted).sort()).toEqual([
    'collapsedSets',
    'expandedRecommendations',
    'filterCollapsed',
    'selectedEquipId',
  ])
  expect(persisted.expandedRecommendations).toEqual({ 'equip-1:sub1': true })
  expect(persisted).not.toHaveProperty('searchQuery')
})

it('drops corrupted persisted expand state', () => {
  expect(sanitizeExpandedRecommendations(undefined)).toEqual({})
  expect(sanitizeExpandedRecommendations('nope')).toEqual({})
  expect(sanitizeExpandedRecommendations([true])).toEqual({})
  expect(sanitizeExpandedRecommendations({ a: true, b: 'yes', c: false })).toEqual({ a: true, c: false })
})
