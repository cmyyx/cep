import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { plannerGameData } from '@/generated/data/planner'
import type { PanelEquipmentSelection, PanelPreviewConfig } from '@/types/planner'

export function createPanelEquipmentSelection(equipmentId: string | null): PanelEquipmentSelection {
  const stats = equipmentId ? plannerGameData.equipment[equipmentId] ?? [] : []
  return { equipmentId, statLevels: stats.map((stat) => Math.max(0, stat.values.length - 1)) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeEquipmentSelection(value: unknown): PanelEquipmentSelection {
  if (!isRecord(value) || typeof value.equipmentId !== 'string' || plannerGameData.equipment[value.equipmentId] === undefined) {
    return createPanelEquipmentSelection(null)
  }
  const defaults = createPanelEquipmentSelection(value.equipmentId)
  const statLevels = Array.isArray(value.statLevels)
    ? value.statLevels.map((level) => typeof level === 'number' && Number.isFinite(level) ? Math.max(0, Math.round(level)) : 0)
    : defaults.statLevels
  return { equipmentId: value.equipmentId, statLevels: statLevels.slice(0, defaults.statLevels.length) }
}

export function normalizePersistedPanelConfig(value: unknown): PanelPreviewConfig | null {
  if (!isRecord(value) || typeof value.characterId !== 'string' || plannerGameData.characters[value.characterId] === undefined) return null
  const defaults = createDefaultPanelPreviewConfig(value.characterId)
  const config = { ...defaults, ...value } as PanelPreviewConfig
  config.potentialLevel = typeof value.potentialLevel === 'number' && Number.isFinite(value.potentialLevel)
    ? Math.min(defaults.potentialLevel, Math.max(0, Math.round(value.potentialLevel)))
    : defaults.potentialLevel
  config.weaponId = typeof value.weaponId === 'string' && plannerGameData.weapons[value.weaponId] !== undefined ? value.weaponId : null
  config.armor = normalizeEquipmentSelection(value.armor)
  config.gloves = normalizeEquipmentSelection(value.gloves)
  config.accessoryOne = normalizeEquipmentSelection(value.accessoryOne)
  config.accessoryTwo = normalizeEquipmentSelection(value.accessoryTwo)
  return config
}

export function createDefaultPanelPreviewConfig(characterId: string): PanelPreviewConfig {
  const character = plannerGameData.characters[characterId]
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

interface PanelPreviewState {
  config: PanelPreviewConfig | null
  setCharacter: (id: string) => void
  updateConfig: (update: Partial<PanelPreviewConfig>) => void
  reset: () => void
}

export const usePanelPreviewStore = create<PanelPreviewState>()(
  persist(
    (set) => ({
      config: null,
      setCharacter: (id) => set({ config: createDefaultPanelPreviewConfig(id) }),
      updateConfig: (update) => set((state) => ({ config: state.config ? { ...state.config, ...update } : null })),
      reset: () => set((state) => ({ config: state.config ? createDefaultPanelPreviewConfig(state.config.characterId) : null })),
    }),
    {
      name: 'panelPreview',
      version: 3,
      partialize: (state) => ({ config: state.config }),
      merge: (persisted, current) => {
        const raw = persisted as { config?: unknown } | null
        return { ...current, config: normalizePersistedPanelConfig(raw?.config) }
      },
    }
  )
)
