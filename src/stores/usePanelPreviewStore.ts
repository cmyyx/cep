import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getCachedPlannerGameData, loadPlannerData } from '@/lib/planner/planner-data-loader'
import { migrateLegacySkillLevelOrder } from '@/lib/planner/progression'
import type { PanelEquipmentSelection, PanelPreviewConfig } from '@/types/planner'

export function createPanelEquipmentSelection(equipmentId: string | null): PanelEquipmentSelection {
  const stats = equipmentId ? getCachedPlannerGameData()?.equipment[equipmentId] ?? [] : []
  return { equipmentId, statLevels: stats.map((stat) => Math.max(0, stat.values.length - 1)) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeEquipmentSelection(value: unknown): PanelEquipmentSelection {
  if (!isRecord(value) || typeof value.equipmentId !== 'string' || getCachedPlannerGameData()?.equipment[value.equipmentId] === undefined) {
    return createPanelEquipmentSelection(null)
  }
  const defaults = createPanelEquipmentSelection(value.equipmentId)
  const statLevels = Array.isArray(value.statLevels)
    ? value.statLevels.map((level) => typeof level === 'number' && Number.isFinite(level) ? Math.max(0, Math.round(level)) : 0)
    : defaults.statLevels
  return { equipmentId: value.equipmentId, statLevels: statLevels.slice(0, defaults.statLevels.length) }
}

/** Clamp a persisted numeric field to an integer inside [min, max]; non-numbers fall back. */
function clampPersistedCount(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function normalizePersistedPanelConfig(value: unknown): PanelPreviewConfig | null {
  const data = getCachedPlannerGameData()
  if (!data || !isRecord(value) || typeof value.characterId !== 'string' || data.characters[value.characterId] === undefined) return null
  const defaults = createDefaultPanelPreviewConfig(value.characterId)
  const config = { ...defaults, ...value } as PanelPreviewConfig
  const character = data.characters[value.characterId]
  // Every numeric field is clamped: a corrupted or hand-edited localStorage
  // entry must never reach progression.ts, where level lookups are exact-match
  // and an out-of-range value silently resolves to the max-level row.
  config.level = clampPersistedCount(value.level, 1, defaults.level, defaults.level)
  config.talentCount = clampPersistedCount(value.talentCount, 0, character.talents.length, defaults.talentCount)
  config.attributeNodeCount = clampPersistedCount(value.attributeNodeCount, 0, character.attributeNodes.length, defaults.attributeNodeCount)
  config.potentialLevel = clampPersistedCount(value.potentialLevel, 0, defaults.potentialLevel, defaults.potentialLevel)
  const sourceSkillLevels = Array.isArray(value.skillLevels) ? value.skillLevels : defaults.skillLevels
  config.skillLevels = character.skills.map((skill, index) => clampPersistedCount(sourceSkillLevels[index], 1, skill.maxLevel, skill.maxLevel))
  config.weaponId = typeof value.weaponId === 'string' && data.weapons[value.weaponId] !== undefined ? value.weaponId : null
  const weapon = config.weaponId ? data.weapons[config.weaponId] : undefined
  const maxWeaponLevel = weapon?.levels.at(-1)?.level ?? defaults.weaponLevel
  config.weaponLevel = clampPersistedCount(value.weaponLevel, 1, maxWeaponLevel, maxWeaponLevel)
  const sourceWeaponSkillLevels = Array.isArray(value.weaponSkillLevels) ? value.weaponSkillLevels : defaults.weaponSkillLevels
  config.weaponSkillLevels = defaults.weaponSkillLevels.map((fallback, index) => {
    const maxSkillLevel = weapon?.skills[index]?.levels.at(-1)?.level ?? fallback
    return clampPersistedCount(sourceWeaponSkillLevels[index], 1, maxSkillLevel, Math.min(fallback, maxSkillLevel))
  })
  config.armor = normalizeEquipmentSelection(value.armor)
  config.gloves = normalizeEquipmentSelection(value.gloves)
  config.accessoryOne = normalizeEquipmentSelection(value.accessoryOne)
  config.accessoryTwo = normalizeEquipmentSelection(value.accessoryTwo)
  return config
}

export function createDefaultPanelPreviewConfig(characterId: string): PanelPreviewConfig {
  const character = getCachedPlannerGameData()?.characters[characterId]
  return {
    characterId,
    level: character?.levels.at(-1)?.level ?? 90,
    skillLevels: character?.skills.map((skill) => skill.maxLevel) ?? [],
    talentCount: character?.talents.length ?? 0,
    potentialLevel: character?.potentials.at(-1)?.level ?? 0,
    attributeNodeCount: character?.attributeNodes.length ?? 0,
    weaponId: null,
    weaponLevel: 90,
    weaponSkillLevels: [9, 9, 9],
    armor: createPanelEquipmentSelection(null),
    gloves: createPanelEquipmentSelection(null),
    accessoryOne: createPanelEquipmentSelection(null),
    accessoryTwo: createPanelEquipmentSelection(null),
  }
}

/**
 * "Reset to max" (`panelPreview.reset`): restore every progression value to its
 * ceiling while KEEPING the chosen weapon and equipment — the button is labelled
 * "恢复全满 / Reset to max", so wiping the build would be data loss, not a reset.
 */
export function maxOutPanelPreviewConfig(config: PanelPreviewConfig): PanelPreviewConfig {
  const defaults = createDefaultPanelPreviewConfig(config.characterId)
  const weapon = config.weaponId ? getCachedPlannerGameData()?.weapons[config.weaponId] : undefined
  return {
    ...defaults,
    weaponId: config.weaponId,
    weaponLevel: weapon?.levels.at(-1)?.level ?? defaults.weaponLevel,
    weaponSkillLevels: defaults.weaponSkillLevels.map((fallback, index) => weapon?.skills[index]?.levels.at(-1)?.level ?? fallback),
    armor: createPanelEquipmentSelection(config.armor?.equipmentId ?? null),
    gloves: createPanelEquipmentSelection(config.gloves?.equipmentId ?? null),
    accessoryOne: createPanelEquipmentSelection(config.accessoryOne?.equipmentId ?? null),
    accessoryTwo: createPanelEquipmentSelection(config.accessoryTwo?.equipmentId ?? null),
  }
}

interface PanelPreviewState {
  config: PanelPreviewConfig | null
  setCharacter: (id: string) => void
  updateConfig: (update: Partial<PanelPreviewConfig>) => void
  /** Re-validate the persisted config against planner data. Requires data loaded; no-op before that. */
  pruneInvalid: () => void
  /** Restore every level to its maximum, keeping the selected weapon and equipment. */
  reset: () => void
}

/**
 * Rehydrate keeps the raw persisted config (planner data loads async); this
 * only checks the structural envelope. Full validation happens in pruneInvalid().
 */
function collectRawPanelConfig(value: unknown): PanelPreviewConfig | null {
  if (!isRecord(value) || typeof value.characterId !== 'string') return null
  return value as unknown as PanelPreviewConfig
}

export const usePanelPreviewStore = create<PanelPreviewState>()(
  persist(
    (set) => ({
      config: null,
      setCharacter: (id) => set({ config: createDefaultPanelPreviewConfig(id) }),
      updateConfig: (update) => set((state) => ({ config: state.config ? { ...state.config, ...update } : null })),
      pruneInvalid: () => {
        if (!getCachedPlannerGameData()) return
        set((state) => ({ config: normalizePersistedPanelConfig(state.config) }))
      },
      reset: () => set((state) => ({ config: state.config ? maxOutPanelPreviewConfig(state.config) : null })),
    }),
    {
      name: 'panelPreview',
      version: 4,
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== 'object' || version >= 4) return persisted
        const state = persisted as { config?: unknown }
        if (!isRecord(state.config)) return persisted
        const skillLevels = migrateLegacySkillLevelOrder(state.config.skillLevels)
        if (!skillLevels) return persisted
        return {
          ...state,
          config: { ...state.config, skillLevels },
        }
      },
      partialize: (state) => ({ config: state.config }),
      merge: (persisted, current) => {
        // Keep the raw config at rehydrate time; pruneInvalid() validates it
        // against planner data once loadPlannerData() resolves (page rendering
        // is gated on the same load, so users never see unvalidated configs).
        const raw = persisted as { config?: unknown } | null
        return { ...current, config: collectRawPanelConfig(raw?.config) }
      },
    }
  )
)

if (typeof window !== 'undefined') {
  // The page-level usePlannerData() gate owns the user-facing retry UI; this
  // module-level prime must still swallow the rejection so a failed chunk
  // import never becomes an unhandled promise rejection.
  loadPlannerData().then(
    () => {
      usePanelPreviewStore.getState().pruneInvalid()
    },
    (error: unknown) => {
      console.error('panelPreview: planner data load failed, persisted config left unvalidated', error)
    },
  )
}
