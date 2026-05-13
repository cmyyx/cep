import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CharacterGuideData } from '@/types/character-guide'
import { characterGuideList } from '@/data/characters'

// ---- Editor draft types ----

export interface EditorDraftCharacter extends CharacterGuideData {
  /** Whether this character is from source data (read-only, must fork to edit) */
  isSource?: boolean
  /** Which source character ID this was forked from (if any) */
  forkedFrom?: string
  /** Raw JSON strings for each editable field (for JSON editor tab) */
  jsonDrafts?: {
    skills: string
    talents: string
    baseSkills: string
    guide: string
  }
  jsonErrors?: Partial<Record<'skills' | 'talents' | 'baseSkills' | 'guide', string>>
}

export type GuideSubTab = 'equip' | 'analysis' | 'team'

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
  addImportedCharacter: (data: CharacterGuideData) => EditorDraftCharacter | undefined
  removeDraftCharacter: (id: string) => void
  markDirty: (id: string) => void
  markClean: (id: string) => void
  resetFromBase: (characters: CharacterGuideData[]) => void
  getDraft: (id: string) => EditorDraftCharacter | undefined
  forkCharacter: (id: string) => EditorDraftCharacter | undefined
  isSourceCharacter: (id: string) => boolean

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

function toDraft(data: CharacterGuideData, isSource = false): EditorDraftCharacter {
  return {
    ...data,
    isSource,
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

// Build fresh source drafts from the static character list
function buildSourceDrafts(): EditorDraftCharacter[] {
  return (characterGuideList as CharacterGuideData[]).map((c) => toDraft(c, true))
}

interface PersistedState {
  draftCharacters: EditorDraftCharacter[]
  selectedId: string | null
  activeTab: EditorTab
  guideSubTab: GuideSubTab
  expandedSections: Record<string, boolean>
  editorPickerOpen: boolean
}

export const useEditorStore = create<EditorStoreState>()(
  persist(
    (set, get) => ({
      draftCharacters: buildSourceDrafts(),
      draftVersion: 0,
      selectedId: null,
      dirtyIds: new Set(),
      activeTab: 'basic',
      guideSubTab: 'equip',
      expandedSections: {},
      editorPickerOpen: true,

      initDrafts: (characters) => {
        const source = characters.map((c) => toDraft(c, true))
        // Merge with existing non-source drafts
        const { draftCharacters } = get()
        const modified = draftCharacters.filter((c) => !c.isSource)
        const sourceIds = new Set(source.map((c) => c.id))
        const cleanModified = modified.filter((c) => !sourceIds.has(c.id))
        set({ draftCharacters: [...source, ...cleanModified], dirtyIds: new Set() })
      },

      addDraftCharacter: () => {
        const empty = createEmptyCharacter()
        const { draftCharacters } = get()
        const usedIds = new Set(draftCharacters.map((c) => c.id))
        let baseId = 'new'
        let idx = 1
        while (usedIds.has(baseId)) {
          baseId = `new-${idx}`
          idx++
        }
        empty.id = baseId
        const displayIndex = idx // idx is already incremented past the matched one, so this is the next available number
        empty.name = `New Character ${displayIndex}`
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

      addImportedCharacter: (data) => {
        const { draftCharacters: currentDrafts } = get()
        // Skip if ID already exists
        if (currentDrafts.find((c) => c.id === data.id)) return undefined
        const draft = toDraft(data, false)
        set((s) => ({
          draftCharacters: [...s.draftCharacters, draft],
          selectedId: draft.id,
        }))
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
        const source = characters.map((c) => toDraft(c, true))
        const { draftCharacters } = get()
        const modified = draftCharacters.filter((c) => !c.isSource)
        const sourceIds = new Set(source.map((c) => c.id))
        const cleanModified = modified.filter((c) => !sourceIds.has(c.id))
        set({ draftCharacters: [...source, ...cleanModified], dirtyIds: new Set() })
      },

      forkCharacter: (id) => {
        const { draftCharacters } = get()
        const source = draftCharacters.find((c) => c.id === id)
        if (!source) return undefined
        // Generate new unique ID
        const usedIds = new Set(draftCharacters.map((c) => c.id))
        let newId = `${source.id}-fork`
        let counter = 1
        while (usedIds.has(newId)) {
          newId = `${source.id}-fork-${counter}`
          counter++
        }
        // Use toDraft for proper deep-copy with defensive defaults
        const forked = toDraft(source, false)
        forked.id = newId
        forked.isSource = false
        forked.forkedFrom = source.id
        forked.jsonDrafts = undefined
        forked.jsonErrors = undefined
        set((s) => {
          const newDirty = new Set(s.dirtyIds)
          newDirty.add(newId)
          return {
            draftCharacters: [...s.draftCharacters, forked],
            dirtyIds: newDirty,
            selectedId: newId,
          }
        })
        return forked
      },

      isSourceCharacter: (id) => {
        const draft = get().draftCharacters.find((c) => c.id === id)
        return draft?.isSource ?? false
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
      name: 'cep-editor-drafts',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state): PersistedState => ({
        // Only persist NON-source characters (modified drafts)
        draftCharacters: state.draftCharacters
          .filter((c) => !c.isSource)
          .map((c) => {
            const { jsonDrafts: _jd, jsonErrors: _je, ...rest } = c
            return rest as EditorDraftCharacter
          }),
        selectedId: state.selectedId,
        activeTab: state.activeTab,
        guideSubTab: state.guideSubTab,
        expandedSections: state.expandedSections,
        editorPickerOpen: state.editorPickerOpen,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<PersistedState>
        const persistedDrafts = (p.draftCharacters || []) as EditorDraftCharacter[]

        // Always use fresh source characters from the codebase
        const sourceDrafts = buildSourceDrafts()

        // Keep persisted modified drafts that don't collide with source IDs
        const sourceIds = new Set(sourceDrafts.map((d) => d.id))
        const modifiedDrafts = persistedDrafts.filter(
          (d) => !sourceIds.has(d.id)
        )

        return {
          ...current,
          draftCharacters: [...sourceDrafts, ...modifiedDrafts],
          dirtyIds: new Set(),
          draftVersion: 0,
          selectedId: p.selectedId ?? null,
          activeTab: p.activeTab ?? 'basic',
          guideSubTab: p.guideSubTab ?? 'equip',
          expandedSections: p.expandedSections ?? {},
          editorPickerOpen: p.editorPickerOpen ?? true,
        }
      },
    }
  )
)
