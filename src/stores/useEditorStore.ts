import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CharacterGuideData } from '@/types/character-guide'

// ---- Editor draft types ----

export interface EditorDraftCharacter extends CharacterGuideData {
  /** Raw JSON strings for each editable field (for JSON editor tab) */
  jsonDrafts?: {
    skills: string
    talents: string
    baseSkills: string
    guide: string
  }
  jsonErrors?: Partial<Record<'skills' | 'talents' | 'baseSkills' | 'guide', string>>
}

export type GuideSubTab = 'attribution' | 'equip' | 'analysis' | 'team'

export type EditorTab = 'basic' | 'skills' | 'talents' | 'materials' | 'guide' | 'attributions'

interface EditorStoreState {
  // Draft data
  draftCharacters: EditorDraftCharacter[]
  draftVersion: number
  selectedId: string | null
  dirtyIds: Set<string>

  // UI state
  activeTab: EditorTab
  guideSubTab: GuideSubTab
  expandedSections: Record<string, boolean>
  editorPickerOpen: boolean

  // Actions — draft management
  initDrafts: (characters: CharacterGuideData[]) => void
  addDraftCharacter: () => EditorDraftCharacter
  removeDraftCharacter: (id: string) => void
  markDirty: (id: string) => void
  markClean: (id: string) => void
  resetFromBase: (characters: CharacterGuideData[]) => void
  getDraft: (id: string) => EditorDraftCharacter | undefined

  // Actions — UI
  setActiveTab: (tab: EditorTab) => void
  setGuideSubTab: (sub: GuideSubTab) => void
  setSelectedId: (id: string | null) => void
  toggleSection: (sectionKey: string) => void
  setEditorPickerOpen: (open: boolean) => void
}

// Helper to create a default empty character
function createEmptyCharacter(): CharacterGuideData {
  return {
    id: '',
    name: '',
    rarity: 5,
    element: '',
    weaponType: '',
    mainAbility: '',
    subAbility: '',
    profession: '',
    stats: { strength: '', agility: '', intellect: '', will: '', attack: '', hp: '' },
    skills: [],
    talents: [],
    baseSkills: [],
    potentials: [],
    materials: { elite1: [], elite2: [], elite3: [], elite4: [] },
    guide: {
      equipRows: [],
      analysis: '',
      teamTips: '',
      operationTips: '',
      teamSlots: [],
      attributions: [],
    },
  }
}

function toDraft(data: CharacterGuideData): EditorDraftCharacter {
  return {
    ...data,
    skills: data.skills?.map((s) => ({ ...s, dataTables: s.dataTables?.map((t) => ({ ...t })) })) ?? [],
    talents: data.talents?.map((t) => ({ ...t })) ?? [],
    baseSkills: data.baseSkills?.map((b) => ({ ...b })) ?? [],
    potentials: data.potentials?.map((p) => ({ ...p })) ?? [],
    materials: {
      elite1: [...(data.materials?.elite1 ?? [])],
      elite2: [...(data.materials?.elite2 ?? [])],
      elite3: [...(data.materials?.elite3 ?? [])],
      elite4: [...(data.materials?.elite4 ?? [])],
    },
    guide: {
      ...data.guide,
      equipRows: data.guide?.equipRows?.map((row) => ({
        weapons: row.weapons?.map((w) => ({ ...w })) ?? [],
        equipment: row.equipment?.map((e) => (e ? { ...e } : null)) ?? [null, null, null, null],
      })) ?? [],
      teamSlots: data.guide?.teamSlots?.map((slot) => ({
        ...slot,
        options: slot.options?.map((opt) => ({
          ...opt,
          weapons: opt.weapons?.map((w) => ({ ...w })) ?? [],
          equipment: opt.equipment?.map((e) => ({ ...e })) ?? [],
        })) ?? [],
      })) ?? [],
      attributions: data.guide?.attributions?.map((a) => ({ ...a })) ?? [],
    },
  }
}

export const useEditorStore = create<EditorStoreState>()(
  persist(
    (set, get) => ({
      draftCharacters: [],
      draftVersion: 0,
      selectedId: null,
      dirtyIds: new Set(),
      activeTab: 'basic',
      guideSubTab: 'attribution',
      expandedSections: {},
      editorPickerOpen: true,

      initDrafts: (characters) => {
        const drafts = characters.map(toDraft)
        set({ draftCharacters: drafts, dirtyIds: new Set() })
      },

      addDraftCharacter: () => {
        const empty = createEmptyCharacter()
        // Auto-generate unique ID
        const { draftCharacters } = get()
        const usedIds = new Set(draftCharacters.map((c) => c.id))
        let baseId = 'new'
        let idx = 1
        while (usedIds.has(baseId)) {
          baseId = `new-${idx}`
          idx++
        }
        empty.id = baseId
        empty.name = `New Character ${idx}`
        const draft = toDraft(empty)
        set((s) => {
          const newDirty = new Set(s.dirtyIds)
          newDirty.add(draft.id)
          return {
            draftCharacters: [...s.draftCharacters, draft],
            dirtyIds: newDirty,
            selectedId: draft.id,
          }
        })
        return draft
      },

      removeDraftCharacter: (id) => {
        set((s) => {
          const idx = s.draftCharacters.findIndex((c) => c.id === id)
          if (idx < 0) return s
          const drafts = [...s.draftCharacters]
          drafts.splice(idx, 1)
          const newDirty = new Set(s.dirtyIds)
          newDirty.delete(id)
          const nextId =
            drafts.length > 0
              ? drafts[Math.min(idx, drafts.length - 1)].id
              : null
          return {
            draftCharacters: drafts,
            dirtyIds: newDirty,
            selectedId: s.selectedId === id ? nextId : s.selectedId,
          }
        })
      },

      markDirty: (id) => {
        set((s) => {
          const newDirty = new Set(s.dirtyIds)
          newDirty.add(id)
          return { dirtyIds: newDirty, draftVersion: s.draftVersion + 1 }
        })
      },

      markClean: (id) => {
        set((s) => {
          const newDirty = new Set(s.dirtyIds)
          newDirty.delete(id)
          return { dirtyIds: newDirty }
        })
      },

      resetFromBase: (characters) => {
        const drafts = characters.map(toDraft)
        set({ draftCharacters: drafts, dirtyIds: new Set() })
      },

      getDraft: (id) => {
        return get().draftCharacters.find((c) => c.id === id)
      },

      setActiveTab: (tab) => set({ activeTab: tab }),
      setGuideSubTab: (sub) => set({ guideSubTab: sub }),
      setSelectedId: (id) => set({ selectedId: id }),
      toggleSection: (key) => {
        set((s) => ({
          expandedSections: {
            ...s.expandedSections,
            [key]: !s.expandedSections[key],
          },
        }))
      },
      setEditorPickerOpen: (open) => set({ editorPickerOpen: open }),
    }),
    {
      name: 'cep-editor-drafts:v1',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        draftCharacters: state.draftCharacters.map((c) => {
          // Strip jsonDrafts and jsonErrors from persisted data
          const { jsonDrafts: _jd, jsonErrors: _je, ...rest } = c
          return rest
        }),
        dirtyIds: [...state.dirtyIds],
        selectedId: state.selectedId,
        activeTab: state.activeTab,
        guideSubTab: state.guideSubTab,
        expandedSections: state.expandedSections,
        draftVersion: state.draftVersion,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<EditorStoreState>
        return {
          ...current,
          ...p,
          dirtyIds: new Set(p.dirtyIds ?? []),
          draftVersion: p.draftVersion ?? 0,
        }
      },
    }
  )
)
