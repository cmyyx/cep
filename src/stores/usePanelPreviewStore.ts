import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { plannerGameData } from '@/generated/data/planner'
import type { PanelEquipmentSelection, PanelPreviewConfig } from '@/types/planner'

export function createPanelEquipmentSelection(equipmentId: string | null): PanelEquipmentSelection {
  const stats = equipmentId ? plannerGameData.equipment[equipmentId] ?? [] : []
  return { equipmentId, statLevels: stats.map((stat) => Math.max(0, stat.values.length - 1)) }
}

export function createDefaultPanelPreviewConfig(characterId: string): PanelPreviewConfig {
  const character = plannerGameData.characters[characterId]
  return {
    characterId,
    level: character?.levels.at(-1)?.level ?? 90,
    skillLevels: character?.skills.map((skill) => skill.maxLevel) ?? [],
    talentCount: character?.talents.length ?? 0,
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
      version: 2,
      partialize: (state) => ({ config: state.config }),
    }
  )
)
