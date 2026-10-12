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

  // ── 多账号 ──
  /** 按账号隔离基质规划器已选武器（默认开启）。关闭则所有账号共用同一份选择。 */
  separateSelectionPerAccount: boolean
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
  /**
   * 该账号在基质规划器里已选的武器 id。
   *
   * 权威副本存在账号里（跟随导入/导出/云同步一起走），规划器 store 的扁平
   * `selectedWeaponIds` 始终是「当前账号」的镜像（见 useMatrixStore）。
   */
  selectedWeaponIds: string[]
}

/**
 * Untrusted marks patch (import file / third-party data). Values are sanitized
 * by the store, so any shape is accepted here.
 */
export interface AccountMarksPatch {
  weaponOwnership?: unknown
  essenceStatus?: unknown
  weaponNotes?: unknown
  /** 省略 = 保留目标账号已有的选择（旧备份文件不带这个字段）。 */
  selectedWeaponIds?: unknown
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
    /** Source categories hidden from the weapon list. */
    hiddenAcquisitionCategoriesList: string[]
    /** Source categories hidden from plan recommendations. */
    hiddenAcquisitionCategoriesPlans: string[]
    regionFirst: string | null
    regionSecond: string | null
    /** Weapon grid attribute filter collapsed state */
    weaponFilterCollapsed: boolean
    /** Hidden-weapons collapsible section collapsed state (default collapsed) */
    hiddenWeaponsCollapsed: boolean
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
    /** Replace all profiles from an import file; prefers the file's active account id. */
    restoreAccounts: (accounts: unknown, activeAccountId?: unknown) => void
    /** Replace one profile's marks (single-account import / third-party essence data). */
    replaceAccountMarks: (accountId: string | undefined, marks: AccountMarksPatch) => void
    /**
     * Store one profile's weapon selection.
     *
     * Unlike replaceAccountMarks this never falls back to the active account:
     * 账号切换时旧账号可能已被删除/替换，回退会把选择写到错误的账号上。
     */
    setAccountSelection: (accountId: string, weaponIds: readonly string[]) => void
    setHiddenAcquisitionCategories: (scope: 'list' | 'plans', categoryIds: string[]) => void
    setRegionFirst: (region: string | null) => void
    setRegionSecond: (region: string | null) => void
    toggleWeaponFilterCollapsed: () => void
    toggleHiddenWeaponsCollapsed: () => void
    setAutoSyncEnabled: (enabled: boolean) => void
    setNotifyOnSync: (notify: boolean) => void
    /** Toggle pull-success notification */
    setNotifyOnPull: (notify: boolean) => void
    resetAllSettings: () => void
  }
