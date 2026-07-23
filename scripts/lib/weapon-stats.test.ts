import { expect, it } from 'vitest'
import { resolveWeaponStats } from './weapon-stats'
import type { WeaponSkillPatchEntry } from './weapon-stats'

it('classifies slots by upstream skill ID instead of passive blackboard keys', () => {
  const skillPatch: Record<string, WeaponSkillPatchEntry> = {
    wpn_attr_main_low: {
      SkillPatchDataBundle: [{
        skillId: 'wpn_attr_main_low',
        skillName: { id: '1', text: '' },
        blackboard: [{ key: 'mainattr', value: 10 }],
        tagId: 'attr_main',
      }],
    },
    sk_wpn_test: {
      SkillPatchDataBundle: [{
        skillId: 'sk_wpn_test',
        skillName: { id: '2', text: '' },
        blackboard: [{ key: 'atk_up', value: 12 }],
        tagId: 'force',
      }],
    },
  }

  expect(resolveWeaponStats(
    ['wpn_attr_main_low', 'sk_wpn_test'],
    skillPatch,
    { force: 'gst_passive_force' },
    { 2: '强攻·武装整备' },
    { 强攻: 'gst_passive_force' },
  )).toEqual({
    primaryStat: 'gat_passive_attr_main',
    elementalDamage: null,
    specialAbility: 'gst_passive_force',
    unresolvedSkillIds: [],
  })
})

it('reports unknown upstream skill families instead of silently producing incomplete data', () => {
  expect(resolveWeaponStats(
    ['future_weapon_skill'],
    {},
    {},
    {},
    {},
  ).unresolvedSkillIds).toEqual(['future_weapon_skill'])
})

it('keeps every official three-star weapon skill in the special-ability slot', () => {
  const skillPatch: Record<string, WeaponSkillPatchEntry> = {
    wpn_attr_main_low: {
      SkillPatchDataBundle: [{
        skillId: 'wpn_attr_main_low',
        skillName: { id: '1', text: '' },
        blackboard: [{ key: 'mainattr', value: 1 }],
        tagId: 'attr_main',
      }],
    },
  }
  const threeStarIds = [
    'wpn_claym_0010',
    'wpn_funnel_0002',
    'wpn_pistol_0001',
    'wpn_lance_0009',
    'wpn_sword_0003',
  ]
  for (const id of threeStarIds) {
    skillPatch[`sk_${id}`] = {
      SkillPatchDataBundle: [{
        skillId: `sk_${id}`,
        skillName: { id: '2', text: '' },
        blackboard: [{ key: 'atk_up', value: 12 }],
        tagId: 'force',
      }],
    }
  }

  for (const id of threeStarIds) {
    expect(resolveWeaponStats(
      ['wpn_attr_main_low', `sk_${id}`],
      skillPatch,
      { force: 'gst_passive_force' },
      {},
      {},
    )).toMatchObject({
      primaryStat: 'gat_passive_attr_main',
      elementalDamage: null,
      specialAbility: 'gst_passive_force',
      unresolvedSkillIds: [],
    })
  }
})
