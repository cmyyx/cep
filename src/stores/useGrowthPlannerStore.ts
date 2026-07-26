import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createDefaultGrowthConfig, migrateLegacySkillLevelOrder, normalizeGrowthConfig } from '@/lib/planner/progression'
import { getCachedPlannerGameData, loadPlannerData } from '@/lib/planner/planner-data-loader'
import type { GrowthConfig, PlannerEntityKind } from '@/types/planner'

export const REMOVED_CONFIG_CACHE_LIMIT = 50

export interface GrowthPlannerState {
  configs: GrowthConfig[]
  removedConfigs: GrowthConfig[]
  addEntity: (kind: PlannerEntityKind, id: string) => void
  removeEntity: (id: string) => void
  updateConfig: (id: string, update: Partial<GrowthConfig>) => void
  /** Drop configs for unknown entities and re-normalize. Requires planner data loaded; no-op before that. */
  pruneInvalid: () => void
  clear: () => void
}

/**
 * Rehydrate keeps raw persisted entries (planner data loads async); this only
 * checks the structural envelope. Full validation happens in pruneInvalid().
 */
function collectRawGrowthConfigs(value: unknown): GrowthConfig[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is GrowthConfig => {
    if (!entry || typeof entry !== 'object') return false
    const raw = entry as Record<string, unknown>
    return (raw.kind === 'character' || raw.kind === 'weapon') && typeof raw.id === 'string'
  })
}

export function normalizePersistedGrowthConfigs(value: unknown): GrowthConfig[] {
  const data = getCachedPlannerGameData()
  if (!data || !Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const raw = entry as Record<string, unknown>
    if ((raw.kind !== 'character' && raw.kind !== 'weapon') || typeof raw.id !== 'string') return []
    const exists = raw.kind === 'character' ? data.characters[raw.id] !== undefined : data.weapons[raw.id] !== undefined
    if (!exists) return []
    const defaults = createDefaultGrowthConfig(raw.kind, raw.id)
    const known = { ...defaults } as Record<string, unknown>
    for (const key of Object.keys(defaults)) {
      if (key in raw) known[key] = raw[key]
    }
    return [normalizeGrowthConfig(known as unknown as GrowthConfig)]
  })
}
export const useGrowthPlannerStore = create<GrowthPlannerState>()(
  persist(
    (set) => ({
      configs: [],
      removedConfigs: [],
      addEntity: (kind, id) => set((state) => {
        if (state.configs.some((config) => config.id === id)) return state
        const cached = state.removedConfigs.find((config) => config.id === id && config.kind === kind)
        return {
          configs: [...state.configs, cached ? normalizeGrowthConfig(cached) : createDefaultGrowthConfig(kind, id)],
          removedConfigs: cached ? state.removedConfigs.filter((config) => config.id !== id) : state.removedConfigs,
        }
      }),
      removeEntity: (id) => set((state) => {
        const removed = state.configs.find((config) => config.id === id)
        if (!removed) return state
        const removedConfigs = [...state.removedConfigs.filter((config) => config.id !== id), removed]
        return {
          configs: state.configs.filter((config) => config.id !== id),
          removedConfigs: removedConfigs.slice(-REMOVED_CONFIG_CACHE_LIMIT),
        }
      }),
      updateConfig: (id, update) => set((state) => ({
        configs: state.configs.map((config) => {
          if (config.id !== id) return config
          return normalizeGrowthConfig({ ...config, ...update } as GrowthConfig)
        }),
      })),
      pruneInvalid: () => {
        if (!getCachedPlannerGameData()) return
        set((state) => {
          const configs = normalizePersistedGrowthConfigs(state.configs)
          const activeIds = new Set(configs.map((config) => config.id))
          const removedConfigs = normalizePersistedGrowthConfigs(state.removedConfigs)
            .filter((config) => !activeIds.has(config.id))
            .slice(-REMOVED_CONFIG_CACHE_LIMIT)
          return { configs, removedConfigs }
        })
      },
      // Clearing is a bulk remove, not a wipe: move the active configs into the
      // restore cache (same 50-entry budget as removeEntity) so re-adding a
      // target brings back its progress instead of a fresh default.
      clear: () => set((state) => {
        if (state.configs.length === 0) return state
        const clearedIds = new Set(state.configs.map((config) => config.id))
        const removedConfigs = [
          ...state.removedConfigs.filter((config) => !clearedIds.has(config.id)),
          ...state.configs,
        ].slice(-REMOVED_CONFIG_CACHE_LIMIT)
        return { configs: [], removedConfigs }
      }),
    }),
    {
      name: 'growthPlanner',
      version: 2,
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== 'object' || version >= 2) return persisted
        const state = persisted as { configs?: unknown }
        if (!Array.isArray(state.configs)) return persisted
        return {
          ...state,
          configs: state.configs.map((entry) => {
            if (!entry || typeof entry !== 'object') return entry
            const config = entry as Record<string, unknown>
            if (config.kind !== 'character') return entry
            const currentSkillLevels = migrateLegacySkillLevelOrder(config.currentSkillLevels)
            const targetSkillLevels = migrateLegacySkillLevelOrder(config.targetSkillLevels)
            return {
              ...config,
              ...(currentSkillLevels ? { currentSkillLevels } : {}),
              ...(targetSkillLevels ? { targetSkillLevels } : {}),
            }
          }),
        }
      },
      partialize: (state) => ({ configs: state.configs, removedConfigs: state.removedConfigs }),
      merge: (persisted, current) => {
        // Keep raw entries at rehydrate time; pruneInvalid() validates them
        // against planner data once loadPlannerData() resolves (page rendering
        // is gated on the same load, so users never see unvalidated configs).
        const raw = persisted as { configs?: unknown; removedConfigs?: unknown } | null
        return {
          ...current,
          configs: collectRawGrowthConfigs(raw?.configs),
          removedConfigs: collectRawGrowthConfigs(raw?.removedConfigs),
        }
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
      useGrowthPlannerStore.getState().pruneInvalid()
    },
    (error: unknown) => {
      console.error('growthPlanner: planner data load failed, persisted configs left unvalidated', error)
    },
  )
}
