import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  EssenceSettingsState,
  SettingKey,
} from '@/types/essence-settings'
import type { Weapon } from '@/types/matrix'
import { isValidWeaponId, sanitizeCustomWeapons } from '@/lib/persist-sanitizer'
import { resolveWeaponIdKeys } from '@/lib/resolve-weapon-id'

// ─── Defaults ──────────────────────────────────────────────────────────────

const FLAG_DEFAULTS: Record<SettingKey, boolean> = {
  hideEssenceOwnedWeaponsList: false,
  hideUnownedWeaponsList: false,
  hideFourStarWeaponsList: true,
  enableOwnershipEditList: false,
  enableNotesList: false,

  hideEssenceOwnedWeaponsPlans: false,
  hideUnownedWeaponsPlans: false,
  hideFourStarWeaponsPlans: true,
  enableOwnershipEditPlans: false,
  enableNotesPlans: false,

  enableTooltipList: true,
  enableTooltipPlans: true,

  keepUpVisibleList: true,
  keepUpVisiblePlans: true,

  onlyHideWhenBothOwned: false,
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
): Omit<EssenceSettingsState, 'toggleFlag' | 'setWeaponOwnership' | 'setEssenceStatus' | 'setWeaponNote' | 'addCustomWeapon' | 'removeCustomWeapon' | 'updateCustomWeapon' | 'setRegionFirst' | 'setRegionSecond' | 'toggleWeaponFilterCollapsed' | 'setAutoSyncEnabled' | 'setNotifyOnSync' | 'setNotifyOnPull' | 'resetAllSettings'> {
  const flags = { ...FLAG_DEFAULTS }
  for (const key of Object.keys(FLAG_DEFAULTS) as SettingKey[]) {
    const val = persisted[key]
    if (typeof val === 'boolean') {
      flags[key] = val
    }
  }

  // Compute customWeapons first — we need the active set to filter
  // ownership / essenceStatus / weaponNotes keys (deleted custom weapons
  // still have "custom-" prefixed IDs that isValidWeaponId alone won't catch).
  const customWeapons: Weapon[] = Array.isArray(persisted.customWeapons)
    ? sanitizeCustomWeapons(persisted.customWeapons as Weapon[])
    : []
  const activeCustomIds = new Set(customWeapons.map(w => w.id))

  // Resolve preview: IDs in persisted records, then parse.
  // This runs BEFORE isValidWeaponId filtering so released preview weapons
  // (whose old preview: key is no longer in knownWeaponIds) aren't lost.
  const rawOwnership = resolveWeaponIdKeys(
    isDefined(persisted.weaponOwnership) ? (persisted.weaponOwnership as Record<string, unknown>) : {},
  )
  const rawEssenceStatus = resolveWeaponIdKeys(
    isDefined(persisted.essenceStatus) ? (persisted.essenceStatus as Record<string, unknown>) : {},
  )
  const rawWeaponNotes = resolveWeaponIdKeys(
    isDefined(persisted.weaponNotes) ? (persisted.weaponNotes as Record<string, unknown>) : {},
  )

  const ownership: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(rawOwnership)) {
    if (v === true && isValidWeaponId(k) && (activeCustomIds.has(k) || !k.startsWith('custom-'))) ownership[k] = true
  }
  const essenceStatus: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(rawEssenceStatus)) {
    if (v === true && isValidWeaponId(k) && (activeCustomIds.has(k) || !k.startsWith('custom-'))) essenceStatus[k] = true
  }
  const weaponNotes: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawWeaponNotes)) {
    if (typeof v === 'string' && isValidWeaponId(k) && (activeCustomIds.has(k) || !k.startsWith('custom-'))) weaponNotes[k] = v
  }
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

  return { ...flags, weaponOwnership: ownership, essenceStatus, weaponNotes, customWeapons, regionFirst, regionSecond, weaponFilterCollapsed, autoSyncEnabled, notifyOnSync, notifyOnPull }
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useEssenceSettingsStore = create<EssenceSettingsState>()(
  persist(
    (set) => ({
      ...FLAG_DEFAULTS,

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
          return { weaponOwnership: next }
        }),

      setEssenceStatus: (weaponId: string, status: boolean) =>
        set((s) => {
          const next = { ...s.essenceStatus }
          if (status) {
            next[weaponId] = true
          } else {
            delete next[weaponId]
          }
          return { essenceStatus: next }
        }),

      setWeaponNote: (weaponId: string, note: string) =>
        set((s) => {
          const next = { ...s.weaponNotes }
          if (note.trim() === '') {
            delete next[weaponId]
          } else {
            next[weaponId] = note
          }
          return { weaponNotes: next }
        }),

      addCustomWeapon: (weapon: Weapon) =>
        set((s) => ({
          customWeapons: [...s.customWeapons, weapon],
        })),

      removeCustomWeapon: (weaponId: string) =>
        set((s) => {
          // Also clean up any ownership / essence / notes entries for
          // this weapon so stale data doesn't linger in the session.
          const nextOwnership = { ...s.weaponOwnership }
          delete nextOwnership[weaponId]
          const nextEssence = { ...s.essenceStatus }
          delete nextEssence[weaponId]
          const nextNotes = { ...s.weaponNotes }
          delete nextNotes[weaponId]
          return {
            customWeapons: s.customWeapons.filter((w) => w.id !== weaponId),
            weaponOwnership: nextOwnership,
            essenceStatus: nextEssence,
            weaponNotes: nextNotes,
          }
        }),

      updateCustomWeapon: (weaponId: string, weapon: Weapon) =>
        set((s) => ({
          customWeapons: s.customWeapons.map((w) =>
            w.id === weaponId ? weapon : w,
          ),
        })),

      resetAllSettings: () =>
        set({
          ...FLAG_DEFAULTS,
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
    },
  ),
)
