import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  EssenceSettingsState,
  SettingKey,
} from '@/types/essence-settings'
import type { Weapon } from '@/types/matrix'

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
): Omit<EssenceSettingsState, 'toggleFlag' | 'setWeaponOwnership' | 'setEssenceStatus' | 'setWeaponNote' | 'addCustomWeapon' | 'removeCustomWeapon' | 'updateCustomWeapon' | 'resetAllSettings'> {
  const flags = { ...FLAG_DEFAULTS }
  for (const key of Object.keys(FLAG_DEFAULTS) as SettingKey[]) {
    if (typeof persisted[key] === 'boolean') {
      flags[key] = persisted[key]
    }
  }

  const ownership: Record<string, boolean> = isDefined(persisted.weaponOwnership)
    ? (persisted.weaponOwnership as Record<string, boolean>)
    : {}
  const essenceStatus: Record<string, boolean> = isDefined(persisted.essenceStatus)
    ? (persisted.essenceStatus as Record<string, boolean>)
    : {}
  const weaponNotes: Record<string, string> = isDefined(persisted.weaponNotes)
    ? (persisted.weaponNotes as Record<string, string>)
    : {}
  const customWeapons: Weapon[] = Array.isArray(persisted.customWeapons)
    ? (persisted.customWeapons as Weapon[])
    : []

  return { ...flags, weaponOwnership: ownership, essenceStatus, weaponNotes, customWeapons }
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

      toggleFlag: (key: SettingKey) =>
        set((s) => ({ [key]: !s[key] } as Partial<EssenceSettingsState>)),

      setWeaponOwnership: (weaponId: string, owned: boolean) =>
        set((s) => ({
          weaponOwnership: { ...s.weaponOwnership, [weaponId]: owned },
        })),

      setEssenceStatus: (weaponId: string, status: boolean) =>
        set((s) => ({
          essenceStatus: { ...s.essenceStatus, [weaponId]: status },
        })),

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
        set((s) => ({
          customWeapons: s.customWeapons.filter((w) => w.id !== weaponId),
        })),

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
        }),
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
          resetAllSettings: current.resetAllSettings,
        }
      },
    },
  ),
)
