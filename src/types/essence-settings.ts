import type { Weapon } from './matrix'

/** All boolean settings, keyed for generic toggle. */
export interface EssenceSettingsFlags {
  // ── 武器列表侧 ──
  hideEssenceOwnedWeaponsList: boolean
  hideUnownedWeaponsList: boolean
  hideFourStarWeaponsList: boolean
  enableOwnershipEditList: boolean
  enableNotesList: boolean

  // ── 方案推荐侧 ──
  hideEssenceOwnedWeaponsPlans: boolean
  hideUnownedWeaponsPlans: boolean
  hideFourStarWeaponsPlans: boolean
  enableOwnershipEditPlans: boolean
  enableNotesPlans: boolean

  // ── 子设置 ──
  onlyHideWhenBothOwned: boolean
}

export type SettingKey = keyof EssenceSettingsFlags

/** Persistent user data. */
export interface EssenceUserData {
  weaponOwnership: Record<string, boolean>
  essenceStatus: Record<string, boolean>
  weaponNotes: Record<string, string>
  customWeapons: Weapon[]
}

export type EssenceSettingsState = EssenceSettingsFlags &
  EssenceUserData & {
    /** Region priority: two-level. null means none. */
    regionFirst: string | null
    regionSecond: string | null
    /** Weapon grid attribute filter collapsed state */
    weaponFilterCollapsed: boolean

    toggleFlag: (key: SettingKey) => void
    setWeaponOwnership: (weaponId: string, owned: boolean) => void
    setEssenceStatus: (weaponId: string, status: boolean) => void
    setWeaponNote: (weaponId: string, note: string) => void
    addCustomWeapon: (weapon: Weapon) => void
    removeCustomWeapon: (weaponId: string) => void
    updateCustomWeapon: (weaponId: string, weapon: Weapon) => void
    setRegionFirst: (region: string | null) => void
    setRegionSecond: (region: string | null) => void
    toggleWeaponFilterCollapsed: () => void
    resetAllSettings: () => void
  }
