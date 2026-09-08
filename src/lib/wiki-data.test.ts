import { expect, it } from 'vitest'
import {
  getLocalizedEquipmentWikiDetail,
  getLocalizedWeaponWikiDetail,
} from './wiki-data'

it('hydrates localized detail text from the generated wikiData catalog', () => {
  const equipment = getLocalizedEquipmentWikiDetail('item_equip_t4_suit_atb01_body_01', 'en')
  expect(equipment?.detail.stats[0]?.displayValues?.[0]).toBe('56')
  expect(equipment?.detail.suitEffects[0]?.name).toBeTruthy()

  const weapon = getLocalizedWeaponWikiDetail('wpn_sword_0005', 'en')
  expect(weapon?.detail.skills[0]?.name).toBeTruthy()
  expect(weapon?.detail.skills[0]?.levels[0]?.description).toBeTruthy()
})
