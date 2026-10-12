/**
 * 基质标记导入落库层。
 *
 * 唯一入口：所有导入写入都必须经过这里，再由 store action 同步 accounts 与
 * 平铺镜像字段 —— 直接写 localStorage 会被 store 的下一次 persist 覆盖。
 */

import { useEssenceSettingsStore, normalizeEssenceSettingsFlags, normalizeCategoryList } from '@/stores/useEssenceSettingsStore'
import { sanitizeCustomWeapons } from '@/lib/persist-sanitizer'
import type { AccountMarksPatch, EssenceSettingsState, SettingKey } from '@/types/essence-settings'

/** How a CEP backup applies to the local account list. */
export type EssenceRestoreMode =
  /** Replace every local profile with the file's profiles (backup restore). */
  | 'restore'
  /** Overwrite the marks of one local profile; other profiles stay as they are. */
  | 'active'

export interface CepEssenceImportOptions {
  /** Defaults to 'restore' when the file carries accounts, otherwise 'active'. */
  mode?: EssenceRestoreMode
  /** Target profile for 'active' mode (defaults to the current active account). */
  accountId?: string
  /** Source profile inside the file for 'active' mode (defaults to the file's active account). */
  sourceAccountId?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// ─── File-side account list ─────────────────────────────────

/** Prefix of the index key used for file accounts that carry no usable id. */
export const FILE_ACCOUNT_KEY_PREFIX = '#'

export interface FileAccountSummary {
  /** Account id from the file, or `#<index>` when the entry has none. */
  id: string
  name: string
  /** Marks (ownership + essence + notes) carried by this account entry. */
  markCount: number
}

function accountKey(account: Record<string, unknown>, index: number): string {
  const id = account.id
  return typeof id === 'string' && id.length > 0 ? id : `${FILE_ACCOUNT_KEY_PREFIX}${index}`
}

/**
 * Records of an import file's `accounts` array, paired with a stable picker key.
 *
 * Indexes come from the raw array so the picker key keeps pointing at the same
 * entry even when some array slots are not objects (see findFileAccount).
 */
function fileAccountEntries(data: unknown): { account: Record<string, unknown>; key: string }[] {
  if (!isRecord(data) || !Array.isArray(data.accounts)) return []
  const entries: { account: Record<string, unknown>; key: string }[] = []
  data.accounts.forEach((raw, index) => {
    if (!isRecord(raw)) return
    entries.push({ account: raw, key: accountKey(raw, index) })
  })
  return entries
}

function findFileAccount(data: unknown, key: string | undefined): Record<string, unknown> | undefined {
  if (!key) return undefined
  return fileAccountEntries(data).find((entry) => entry.key === key)?.account
}

/** Pickable account list of a CEP backup (empty for a flat v1 file without accounts). */
export function listFileAccounts(data: unknown): FileAccountSummary[] {
  return fileAccountEntries(data).map(({ account, key }) => {
    let markCount = 0
    for (const field of ['weaponOwnership', 'essenceStatus', 'weaponNotes'] as const) {
      if (isRecord(account[field])) markCount += Object.keys(account[field] as object).length
    }
    return {
      id: key,
      name: typeof account.name === 'string' ? account.name : '',
      markCount,
    }
  })
}

/**
 * Read the marks a CEP backup should apply: the selected file account, else the
 * file's active account, else the first one, else the legacy flat fields of a
 * v1 file without accounts.
 */
function readFileMarks(data: Record<string, unknown>, sourceAccountId?: string): AccountMarksPatch {
  const entries = fileAccountEntries(data)
  const raw =
    findFileAccount(data, sourceAccountId) ??
    entries.find((entry) => entry.account.id === data.activeAccountId)?.account ??
    entries[0]?.account
  if (raw) {
    // Normalize to {} so an omitted field means "empty", not "keep local": a
    // backup restore must reproduce the file, not merge into the local profile.
    return {
      weaponOwnership: raw.weaponOwnership ?? {},
      essenceStatus: raw.essenceStatus ?? {},
      weaponNotes: raw.weaponNotes ?? {},
    }
  }
  return {
    weaponOwnership: data.weaponOwnership ?? {},
    essenceStatus: data.essenceStatus ?? {},
    weaponNotes: data.weaponNotes ?? {},
  }
}

// ─── Global (account-independent) preferences ───────────────

/** Everything the `essence-settings` module carries that is NOT per-account. */
type GlobalPreferences = Pick<
  EssenceSettingsState,
  | 'customWeapons'
  | 'regionFirst'
  | 'regionSecond'
  | 'hiddenAcquisitionCategoriesList'
  | 'hiddenAcquisitionCategoriesPlans'
  | 'weaponFilterCollapsed'
  | 'hiddenWeaponsCollapsed'
  | 'autoSyncEnabled'
  | 'notifyOnSync'
  | 'notifyOnPull'
> &
  Record<SettingKey, boolean>

/**
 * Read the file's global preferences. A missing field falls back to the app
 * default (not to the local value): a full restore reproduces the file.
 */
function readGlobalPreferences(data: Record<string, unknown>): GlobalPreferences {
  const bool = (key: string, fallback: boolean) =>
    typeof data[key] === 'boolean' ? (data[key] as boolean) : fallback
  return {
    customWeapons: sanitizeCustomWeapons(data.customWeapons),
    ...normalizeEssenceSettingsFlags(isRecord(data.flags) ? data.flags : data),
    regionFirst: typeof data.regionFirst === 'string' ? data.regionFirst : null,
    regionSecond: typeof data.regionSecond === 'string' ? data.regionSecond : null,
    hiddenAcquisitionCategoriesList: normalizeCategoryList(data.hiddenAcquisitionCategoriesList),
    hiddenAcquisitionCategoriesPlans: normalizeCategoryList(data.hiddenAcquisitionCategoriesPlans),
    weaponFilterCollapsed: bool('weaponFilterCollapsed', false),
    hiddenWeaponsCollapsed: bool('hiddenWeaponsCollapsed', true),
    // Per-device toggles: a full restore reproduces the file like every other field.
    autoSyncEnabled: bool('autoSyncEnabled', true),
    notifyOnSync: bool('notifyOnSync', false),
    notifyOnPull: bool('notifyOnPull', false),
  }
}

/**
 * Apply the `essence-settings` module of a CEP backup file.
 *
 * 'restore' reproduces the whole file (accounts + global preferences).
 * 'active' writes only the selected account's marks and leaves every global
 * preference alone, so importing one account cannot rewrite the local theme of
 * display settings / custom weapons.
 */
export function applyCepEssenceSettings(data: unknown, options: CepEssenceImportOptions = {}): void {
  if (!isRecord(data)) return

  const store = useEssenceSettingsStore.getState()
  const accounts = Array.isArray(data.accounts) ? data.accounts : []
  const mode = options.mode ?? (accounts.length > 0 ? 'restore' : 'active')

  if (mode === 'restore' && accounts.length > 0) {
    store.restoreAccounts(accounts, data.activeAccountId)
    useEssenceSettingsStore.setState(readGlobalPreferences(data))
    return
  }

  store.replaceAccountMarks(options.accountId, readFileMarks(data, options.sourceAccountId))
}

/**
 * Apply a MaaEND 无暇基质库存 scan to one profile.
 *
 * Replace semantics: the file is a complete inventory scan, so a weapon that is
 * absent means "no essence for it". Weapon ownership and notes are never touched
 * — MaaEND only reports essences, not owned weapons.
 */
export function applyMaaEndEssence(weaponIds: readonly string[], accountId?: string): void {
  const essenceStatus: Record<string, boolean> = {}
  for (const weaponId of weaponIds) essenceStatus[weaponId] = true
  useEssenceSettingsStore.getState().replaceAccountMarks(accountId, { essenceStatus })
}
