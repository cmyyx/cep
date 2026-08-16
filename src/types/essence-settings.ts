import type { Weapon } from './matrix'

/** All boolean settings, keyed for generic toggle. */
export interface EssenceSettingsFlags {
  // ── 武器列表侧 ──
  hideEssenceOwnedWeaponsList: boolean
  hideUnownedWeaponsList: boolean
  hideFourStarWeaponsList: boolean
  hideThreeStarWeaponsList: boolean
  onlyHideWhenBothOwnedList: boolean
  enableOwnershipEditList: boolean
  enableNotesList: boolean

  // ── 方案推荐侧 ──
  hideEssenceOwnedWeaponsPlans: boolean
  hideUnownedWeaponsPlans: boolean
  hideFourStarWeaponsPlans: boolean
  hideThreeStarWeaponsPlans: boolean
  onlyHideWhenBothOwnedPlans: boolean
  enableOwnershipEditPlans: boolean
  enableNotesPlans: boolean

  // ── UP 武器穿透隐藏 ──
  keepUpVisibleList: boolean
  keepUpVisiblePlans: boolean

  // ── Tooltip ──
  enableTooltipList: boolean
  enableTooltipPlans: boolean

}

export type SettingKey = keyof EssenceSettingsFlags

/**
 * One game-account profile. Marks (ownership / essence / notes) are isolated
 * per account; custom weapons and UI preferences are global.
 */
export interface EssenceAccount {
  id: string
  name: string
  weaponOwnership: Record<string, boolean>
  essenceStatus: Record<string, boolean>
  weaponNotes: Record<string, string>
}

/**
 * Persistent user data.
 *
 * `weaponOwnership` / `essenceStatus` / `weaponNotes` are the ACTIVE account's
 * marks (mirrored from `accounts` for zero-churn component reads). `accounts`
 * is the single source of truth for sync and persistence.
 */
export interface EssenceUserData {
  accounts: EssenceAccount[]
  activeAccountId: string
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
    /** Premium auto-sync toggle (per-device, persisted) */
    autoSyncEnabled: boolean
    /** Show a brief check icon when sync succeeds (non-blocking) */
    notifyOnSync: boolean
    /** Show a brief notification when pull (download) from cloud succeeds */
    notifyOnPull: boolean
    toggleFlag: (key: SettingKey) => void
    setWeaponOwnership: (weaponId: string, owned: boolean) => void
    setEssenceStatus: (weaponId: string, status: boolean) => void
    setWeaponNote: (weaponId: string, note: string) => void
    addCustomWeapon: (weapon: Weapon) => void
    removeCustomWeapon: (weaponId: string) => void
    updateCustomWeapon: (weaponId: string, weapon: Weapon) => void
    /** Create a new game-account profile with empty marks; returns its id, or null when at MAX_ACCOUNTS. */
    addAccount: (name?: string) => string | null
    renameAccount: (accountId: string, name: string) => void
    /** Delete a profile and its marks. The last account cannot be removed. */
    removeAccount: (accountId: string) => void
    /** Switch the active profile; marks mirror to the top-level fields. */
    setActiveAccount: (accountId: string) => void
    /** Replace all profiles from a cloud payload (keeps active id when possible). */
    applyAccounts: (accounts: EssenceAccount[]) => void
    setRegionFirst: (region: string | null) => void
    setRegionSecond: (region: string | null) => void
    toggleWeaponFilterCollapsed: () => void
    setAutoSyncEnabled: (enabled: boolean) => void
    setNotifyOnSync: (notify: boolean) => void
    /** Toggle pull-success notification */
    setNotifyOnPull: (notify: boolean) => void
    resetAllSettings: () => void
  }
