import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  EssenceAccount,
  EssenceSettingsState,
  SettingKey,
} from '@/types/essence-settings'
import type { Weapon } from '@/types/matrix'
import { isValidWeaponId, sanitizeCustomWeapons } from '@/lib/persist-sanitizer'
import { resolveWeaponIdKeys } from '@/lib/resolve-weapon-id'
import { createAccountId, MAX_ACCOUNTS, sanitizeCloudAccounts } from '@/lib/essence-accounts'

// ─── Defaults ──────────────────────────────────────────────────────────────

const FLAG_DEFAULTS: Record<SettingKey, boolean> = {
  hideEssenceOwnedWeaponsList: false,
  hideUnownedWeaponsList: false,
  hideFourStarWeaponsList: true,
  hideThreeStarWeaponsList: true,
  onlyHideWhenBothOwnedList: false,
  enableOwnershipEditList: false,
  enableNotesList: false,

  hideEssenceOwnedWeaponsPlans: false,
  hideUnownedWeaponsPlans: false,
  hideFourStarWeaponsPlans: true,
  hideThreeStarWeaponsPlans: true,
  onlyHideWhenBothOwnedPlans: false,
  enableOwnershipEditPlans: false,
  enableNotesPlans: false,

  enableTooltipList: true,
  enableTooltipPlans: true,

  keepUpVisibleList: true,
  keepUpVisiblePlans: true,

}

export function normalizeEssenceSettingsFlags(
  flags: unknown,
): Record<SettingKey, boolean> {
  const source = isDefined(flags) ? flags : {}
  const normalized = { ...FLAG_DEFAULTS }
  for (const key of Object.keys(FLAG_DEFAULTS) as SettingKey[]) {
    if (typeof source[key] === 'boolean') normalized[key] = source[key]
  }
  return normalized
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isDefined(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object'
}

/**
 * Decode persisted JSON with schema validation.
 * Corrupted keys fall back to defaults.
 * Returns only data properties (no actions).
 */
function mergeWithDefaults(
  persisted: Record<string, unknown>,
): Omit<EssenceSettingsState, 'toggleFlag' | 'setWeaponOwnership' | 'setEssenceStatus' | 'setWeaponNote' | 'addCustomWeapon' | 'removeCustomWeapon' | 'updateCustomWeapon' | 'addAccount' | 'renameAccount' | 'removeAccount' | 'setActiveAccount' | 'applyAccounts' | 'setRegionFirst' | 'setRegionSecond' | 'toggleWeaponFilterCollapsed' | 'setAutoSyncEnabled' | 'setNotifyOnSync' | 'setNotifyOnPull' | 'resetAllSettings'> {
  const flags = normalizeEssenceSettingsFlags(persisted)

  // Compute customWeapons first — we need the active set to filter
  // ownership / essenceStatus / weaponNotes keys (deleted custom weapons
  // still have "custom-" prefixed IDs that isValidWeaponId alone won't catch).
  const customWeapons = sanitizeCustomWeapons(persisted.customWeapons)
  const activeCustomIds = new Set(customWeapons.map(w => w.id))

  // Filter a marks record: resolve preview ids, keep valid weapon ids that
  // are either built-in or still-active custom weapons.
  const filterMarks = <T extends boolean | string>(
    raw: unknown,
    isValueValid: (v: unknown) => v is T,
  ): Record<string, T> => {
    const resolved = resolveWeaponIdKeys(isDefined(raw) ? raw : {})
    const out: Record<string, T> = {}
    for (const [k, v] of Object.entries(resolved)) {
      if (!isValueValid(v)) continue
      if (!isValidWeaponId(k)) continue
      if (activeCustomIds.has(k) || !k.startsWith('custom-')) out[k] = v
    }
    return out
  }

  // ── Game-account profiles ────────────────────────────────
  // accounts is the source of truth; the flat marks below are the ACTIVE
  // account's mirror. Legacy persisted data (flat marks, no accounts) is
  // folded into a single default account ("账号 1").
  const sanitizeAccountMarks = (raw: Record<string, unknown>) => ({
    weaponOwnership: filterMarks(raw.weaponOwnership, (v): v is boolean => v === true),
    essenceStatus: filterMarks(raw.essenceStatus, (v): v is boolean => v === true),
    weaponNotes: filterMarks(raw.weaponNotes, (v): v is string => typeof v === 'string'),
  })

  const persistedAccounts = sanitizeCloudAccounts(persisted.accounts)
  const accounts: EssenceAccount[] = persistedAccounts.length > 0
    ? persistedAccounts.map((account) => ({
        ...account,
        ...sanitizeAccountMarks({ weaponOwnership: account.weaponOwnership, essenceStatus: account.essenceStatus, weaponNotes: account.weaponNotes }),
      }))
    : [{
        id: createAccountId(),
        name: DEFAULT_ACCOUNT_NAME,
        ...sanitizeAccountMarks(persisted),
      }]

  const persistedActiveId = typeof persisted.activeAccountId === 'string' ? persisted.activeAccountId : ''
  const activeAccountId = accounts.some((a) => a.id === persistedActiveId) ? persistedActiveId : accounts[0].id
  const active = accounts.find((a) => a.id === activeAccountId) ?? accounts[0]

  const regionFirst: string | null =
    typeof persisted.regionFirst === 'string' ? persisted.regionFirst : null
  const regionSecond: string | null =
    typeof persisted.regionSecond === 'string' ? persisted.regionSecond : null
  const weaponFilterCollapsed: boolean =
    typeof persisted.weaponFilterCollapsed === 'boolean' ? persisted.weaponFilterCollapsed : false
  const autoSyncEnabled: boolean =
    typeof persisted.autoSyncEnabled === 'boolean' ? persisted.autoSyncEnabled : true
  const notifyOnSync: boolean =
    typeof persisted.notifyOnSync === 'boolean' ? persisted.notifyOnSync : false
  const notifyOnPull: boolean =
    typeof persisted.notifyOnPull === 'boolean' ? persisted.notifyOnPull : false

  return {
    ...flags,
    accounts,
    activeAccountId,
    weaponOwnership: active.weaponOwnership,
    essenceStatus: active.essenceStatus,
    weaponNotes: active.weaponNotes,
    customWeapons,
    regionFirst,
    regionSecond,
    weaponFilterCollapsed,
    autoSyncEnabled,
    notifyOnSync,
    notifyOnPull,
  }
}

// ─── Store ─────────────────────────────────────────────────────────────────

/** Stable default account id used before hydration / after resets. */
const DEFAULT_ACCOUNT_ID = createAccountId()
/** Default remark for the first account (the UI passes a translated name for new accounts). */
export const DEFAULT_ACCOUNT_NAME = '账号 1'

/**
 * Apply a marks patch to the active account and mirror it to the top-level
 * fields so existing components keep reading the flat shape.
 * 当 activeAccountId 不匹配任何账户(如云端同步后)时回退到第一个账户,
 * 并同步 activeAccountId,避免补丁落到空处。
 */
function patchActiveAccountMarks(
  state: EssenceSettingsState,
  patch: Partial<Pick<EssenceAccount, 'weaponOwnership' | 'essenceStatus' | 'weaponNotes'>>,
): Partial<EssenceSettingsState> {
  const target = state.accounts.find((account) => account.id === state.activeAccountId) ?? state.accounts[0]
  if (!target) return { ...patch }
  const accounts = state.accounts.map((account) =>
    account.id === target.id ? { ...account, ...patch } : account,
  )
  return {
    accounts,
    ...(target.id !== state.activeAccountId ? { activeAccountId: target.id } : {}),
    ...patch,
  }
}


export const useEssenceSettingsStore = create<EssenceSettingsState>()(
  persist(
    (set, get) => ({
      ...FLAG_DEFAULTS,

      accounts: [{
        id: DEFAULT_ACCOUNT_ID,
        name: DEFAULT_ACCOUNT_NAME,
        weaponOwnership: {},
        essenceStatus: {},
        weaponNotes: {},
      }],
      activeAccountId: DEFAULT_ACCOUNT_ID,
      weaponOwnership: {},
      essenceStatus: {},
      weaponNotes: {},
      customWeapons: [],
      regionFirst: null,
      regionSecond: null,
      weaponFilterCollapsed: false,
      autoSyncEnabled: true,
      notifyOnSync: false,
      notifyOnPull: false,
      toggleFlag: (key: SettingKey) =>
        set((s) => ({ [key]: !s[key] } as Partial<EssenceSettingsState>)),

      setWeaponOwnership: (weaponId: string, owned: boolean) =>
        set((s) => {
          const next = { ...s.weaponOwnership }
          if (owned) {
            next[weaponId] = true
          } else {
            delete next[weaponId]
          }
          return patchActiveAccountMarks(s, { weaponOwnership: next })
        }),

      setEssenceStatus: (weaponId: string, status: boolean) =>
        set((s) => {
          const next = { ...s.essenceStatus }
          if (status) {
            next[weaponId] = true
          } else {
            delete next[weaponId]
          }
          return patchActiveAccountMarks(s, { essenceStatus: next })
        }),

      setWeaponNote: (weaponId: string, note: string) =>
        set((s) => {
          const next = { ...s.weaponNotes }
          if (note.trim() === '') {
            delete next[weaponId]
          } else {
            next[weaponId] = note
          }
          return patchActiveAccountMarks(s, { weaponNotes: next })
        }),

      addAccount: (name?: string) => {
        // 容量满时返回 null(调用方不能拿到一个"看似成功"的 id)
        if (get().accounts.length >= MAX_ACCOUNTS) return null
        const id = createAccountId()
        set((s) => {
          const account: EssenceAccount = {
            id,
            name: name ?? `账号 ${s.accounts.length + 1}`,
            weaponOwnership: {},
            essenceStatus: {},
            weaponNotes: {},
          }
          return {
            accounts: [...s.accounts, account],
            activeAccountId: id,
            weaponOwnership: account.weaponOwnership,
            essenceStatus: account.essenceStatus,
            weaponNotes: account.weaponNotes,
          }
        })
        return id
      },

      renameAccount: (accountId: string, name: string) =>
        set((s) => ({
          accounts: s.accounts.map((account) =>
            account.id === accountId ? { ...account, name } : account,
          ),
        })),

      removeAccount: (accountId: string) =>
        set((s) => {
          if (s.accounts.length <= 1) return s
          const accounts = s.accounts.filter((account) => account.id !== accountId)
          if (accounts.length === s.accounts.length) return s
          if (s.activeAccountId !== accountId) return { accounts }
          const active = accounts[0]
          return {
            accounts,
            activeAccountId: active.id,
            weaponOwnership: active.weaponOwnership,
            essenceStatus: active.essenceStatus,
            weaponNotes: active.weaponNotes,
          }
        }),

      setActiveAccount: (accountId: string) =>
        set((s) => {
          const account = s.accounts.find((a) => a.id === accountId)
          if (!account) return s
          return {
            activeAccountId: account.id,
            weaponOwnership: account.weaponOwnership,
            essenceStatus: account.essenceStatus,
            weaponNotes: account.weaponNotes,
          }
        }),

      applyAccounts: (accounts: EssenceAccount[]) => {
        if (accounts.length === 0) return
        set((s) => {
          const next = sanitizeCloudAccounts(accounts)
          if (next.length === 0) return s
          const active = next.find((a) => a.id === s.activeAccountId) ?? next[0]
          return {
            accounts: next,
            activeAccountId: active.id,
            weaponOwnership: active.weaponOwnership,
            essenceStatus: active.essenceStatus,
            weaponNotes: active.weaponNotes,
          }
        })
      },

      addCustomWeapon: (weapon: Weapon) =>
        set((s) => ({
          customWeapons: [...s.customWeapons, weapon],
        })),

      removeCustomWeapon: (weaponId: string) =>
        set((s) => {
          // Custom weapons are global definitions: removing one purges its
          // marks from EVERY game-account profile so stale data can't linger.
          const strip = <T extends Record<string, boolean | string>>(marks: T): T => {
            const next = { ...marks }
            delete (next as Record<string, unknown>)[weaponId]
            return next
          }
          const accounts = s.accounts.map((account) => ({
            ...account,
            weaponOwnership: strip(account.weaponOwnership),
            essenceStatus: strip(account.essenceStatus),
            weaponNotes: strip(account.weaponNotes),
          }))
          return {
            customWeapons: s.customWeapons.filter((w) => w.id !== weaponId),
            accounts,
            weaponOwnership: strip(s.weaponOwnership),
            essenceStatus: strip(s.essenceStatus),
            weaponNotes: strip(s.weaponNotes),
          }
        }),

      updateCustomWeapon: (weaponId: string, weapon: Weapon) =>
        set((s) => ({
          customWeapons: s.customWeapons.map((w) =>
            w.id === weaponId ? weapon : w,
          ),
        })),

      resetAllSettings: () =>
        set(() => {
          const account: EssenceAccount = {
            id: DEFAULT_ACCOUNT_ID,
            name: DEFAULT_ACCOUNT_NAME,
            weaponOwnership: {},
            essenceStatus: {},
            weaponNotes: {},
          }
          return {
            ...FLAG_DEFAULTS,
            accounts: [account],
            activeAccountId: account.id,
            weaponOwnership: account.weaponOwnership,
            essenceStatus: account.essenceStatus,
            weaponNotes: account.weaponNotes,
            customWeapons: [],
            regionFirst: null,
            regionSecond: null,
            weaponFilterCollapsed: false,
            autoSyncEnabled: true,
            notifyOnSync: false,
            notifyOnPull: false,
          }
        }),

      setRegionFirst: (region: string | null) =>
        set((s) => {
          // If clearing first, also clear second
          const second = region === null ? null : s.regionSecond === region ? null : s.regionSecond
          return { regionFirst: region, regionSecond: second }
        }),

      setRegionSecond: (region: string | null) =>
        set({ regionSecond: region }),

      toggleWeaponFilterCollapsed: () =>
        set((s) => ({ weaponFilterCollapsed: !s.weaponFilterCollapsed })),

      setAutoSyncEnabled: (enabled: boolean) =>
        set({ autoSyncEnabled: enabled }),

      setNotifyOnSync: (notify: boolean) =>
        set({ notifyOnSync: notify }),

      setNotifyOnPull: (notify: boolean) =>
        set({ notifyOnPull: notify }),
    }),
    {
      name: 'essence-settings',
      merge: (persisted, current) => {
        const merged = mergeWithDefaults(
          isDefined(persisted) ? (persisted as Record<string, unknown>) : {},
        )
        return {
          ...current,
          ...merged,
          toggleFlag: current.toggleFlag,
          setWeaponOwnership: current.setWeaponOwnership,
          setEssenceStatus: current.setEssenceStatus,
          setWeaponNote: current.setWeaponNote,
          addAccount: current.addAccount,
          renameAccount: current.renameAccount,
          removeAccount: current.removeAccount,
          setActiveAccount: current.setActiveAccount,
          applyAccounts: current.applyAccounts,
          addCustomWeapon: current.addCustomWeapon,
          removeCustomWeapon: current.removeCustomWeapon,
          updateCustomWeapon: current.updateCustomWeapon,
          setRegionFirst: current.setRegionFirst,
          setRegionSecond: current.setRegionSecond,
          toggleWeaponFilterCollapsed: current.toggleWeaponFilterCollapsed,
          setAutoSyncEnabled: current.setAutoSyncEnabled,
          setNotifyOnSync: current.setNotifyOnSync,
          setNotifyOnPull: current.setNotifyOnPull,
          resetAllSettings: current.resetAllSettings,
        }
      },
      /**
       * After rehydration, force-write the resolved state back to localStorage
       * to clean up stale preview:* keys.
       *
       * The merge phase above resolves stale preview keys (e.g.
       * "preview:赤缨" → "wpn_claym_0017") in weaponOwnership / essenceStatus /
       * weaponNotes. However, zustand/persist's hydration path calls the
       * ORIGINAL setState (not the wrapped one that triggers setItem), so
       * localStorage is NOT updated during rehydration. The old preview:*
       * keys persist indefinitely until the user triggers a state change.
       *
       * We bypass zustand's setState→setItem chain entirely and write
       * directly to localStorage using the same { state, version } envelope
       * that zustand/persist expects. The current in-memory state (from get())
       * has already been resolved by merge — we just need to persist it.
       */
      onRehydrateStorage: () => {
        return () => {
          try {
            const resolvedState = useEssenceSettingsStore.getState()
            // Serialize with the same envelope zustand/persist uses.
            // JSON.stringify skips functions (store actions), so only
            // data properties (with resolved weapon IDs) are written.
            localStorage.setItem('essence-settings', JSON.stringify({
              state: resolvedState,
              version: 0,
            }))
          } catch {
            // Silently ignore — the merge phase already has the correct
            // state in memory; localStorage will catch up on next user
            // interaction if this write fails (e.g. quota exceeded).
          }
        }
      },
    },
  ),
)
