/**
 * Editor name validation utility.
 *
 * Checks whether weapon/equipment/material names entered in the editor
 * exist in the known game data. Used by editor tabs to show warnings
 * when a user types a name that doesn't match any known entity.
 */

import { weapons as staticWeapons } from '@/data/weapons'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import equipZhCN from '@/generated/i18n/equips/zh-CN.json'
import materialZhCN from '@/generated/i18n/materials/zh-CN.json'

// ── Known name sets (lazily built) ──

let _weaponNames: Set<string> | null = null
let _equipNames: Set<string> | null = null
let _materialNames: Set<string> | null = null

function buildWeaponNames(): Set<string> {
  const names = new Set<string>()
  for (const w of staticWeapons) {
    names.add(w.name)
  }
  try {
    const customWeapons = useEssenceSettingsStore.getState().customWeapons
    for (const w of customWeapons) {
      names.add(w.name)
    }
  } catch {
    // Store not available (SSR/build time)
  }
  return names
}

function buildEquipNames(): Set<string> {
  return new Set(Object.values(equipZhCN as Record<string, string>))
}

function buildMaterialNames(): Set<string> {
  return new Set(Object.values(materialZhCN as Record<string, string>))
}

/** Lazily get known weapon names. */
export function getKnownWeaponNames(): Set<string> {
  if (!_weaponNames) _weaponNames = buildWeaponNames()
  return _weaponNames
}

/** Invalidate cached weapon names (call after custom weapon changes). */
export function invalidateWeaponNamesCache(): void {
  _weaponNames = null
}

/** Lazily get known equipment names. */
export function getKnownEquipNames(): Set<string> {
  if (!_equipNames) _equipNames = buildEquipNames()
  return _equipNames
}

/** Lazily get known material names. */
export function getKnownMaterialNames(): Set<string> {
  if (!_materialNames) _materialNames = buildMaterialNames()
  return _materialNames
}

/** Check if a weapon name is valid (exists in data). Empty = no error. */
export function isWeaponNameValid(name: string): boolean {
  if (!name.trim()) return true
  return getKnownWeaponNames().has(name)
}

/** Check if an equip name is valid (exists in data). Empty = no error. */
export function isEquipNameValid(name: string): boolean {
  if (!name.trim()) return true
  return getKnownEquipNames().has(name)
}

/** Check if a material name is valid (exists in data). Empty = no error. */
export function isMaterialNameValid(name: string): boolean {
  if (!name.trim()) return true
  return getKnownMaterialNames().has(name)
}
