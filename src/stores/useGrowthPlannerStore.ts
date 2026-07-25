import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createDefaultGrowthConfig, migrateLegacySkillLevelOrder, normalizeGrowthConfig } from '@/lib/planner/progression'
import { plannerGameData } from '@/generated/data/planner'
import type { GrowthConfig, PlannerEntityKind } from '@/types/planner'

export interface GrowthPlannerState {
  configs: GrowthConfig[]
  addEntity: (kind: PlannerEntityKind, id: string) => void
  removeEntity: (id: string) => void
  updateConfig: (id: string, update: Partial<GrowthConfig>) => void
  clear: () => void
}


export function normalizePersistedGrowthConfigs(value: unknown): GrowthConfig[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const raw = entry as Record<string, unknown>
    if ((raw.kind !== 'character' && raw.kind !== 'weapon') || typeof raw.id !== 'string') return []
    const exists = raw.kind === 'character' ? plannerGameData.characters[raw.id] !== undefined : plannerGameData.weapons[raw.id] !== undefined
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
      addEntity: (kind, id) => set((state) => {
        if (state.configs.some((config) => config.id === id)) return state
        return { configs: [...state.configs, createDefaultGrowthConfig(kind, id)] }
      }),
      removeEntity: (id) => set((state) => ({
        configs: state.configs.filter((config) => config.id !== id),
      })),
      updateConfig: (id, update) => set((state) => ({
        configs: state.configs.map((config) => {
          if (config.id !== id) return config
          return normalizeGrowthConfig({ ...config, ...update } as GrowthConfig)
        }),
      })),
      clear: () => set({ configs: [] }),
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
      partialize: (state) => ({ configs: state.configs }),
      merge: (persisted, current) => {
        const raw = persisted as { configs?: unknown } | null
        return { ...current, configs: normalizePersistedGrowthConfigs(raw?.configs) }
      },
    }
  )
)
