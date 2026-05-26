/**
 * Editor name validation utility.
 *
 * Checks whether weapon/equipment/material names entered in the editor
 * exist in the known game data. Used by editor tabs to show warnings
 * when a user types a name that doesn't match any known entity.
 */

import { weapons } from '@/data/weapons'
import { equips } from '@/data/equips'
import { MATERIAL_NAMES } from '@/data/material-names'
import { stripMaterialQuantity } from '@/lib/utils'

// ── Known name sets ──

const KNOWN_WEAPON_NAMES = new Set(weapons.filter((w) => !w.id.startsWith('preview:')).map((w) => w.name))

const KNOWN_EQUIP_NAMES = new Set(equips.map((e) => e.name))

// ── Validation ──

export function isWeaponNameValid(name: string): boolean {
  const normalized = name.trim()
  if (!normalized) return true
  return KNOWN_WEAPON_NAMES.has(normalized)
}

export function isEquipNameValid(name: string): boolean {
  const normalized = name.trim()
  if (!normalized) return true
  return KNOWN_EQUIP_NAMES.has(normalized)
}

export function isMaterialNameValid(name: string): boolean {
  if (!name.trim()) return true
  const base = stripMaterialQuantity(name)
  return MATERIAL_NAMES.has(base) || MATERIAL_NAMES.has(name)
}
