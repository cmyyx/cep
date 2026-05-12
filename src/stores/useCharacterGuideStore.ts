import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CharacterGuideData } from '@/types/character-guide'
import { characterGuideList } from '@/data/characters'

interface CharacterGuideState {
  /** All character guide data (base + user overrides) */
  characters: CharacterGuideData[]
  /** Currently selected character ID */
  selectedId: string | null

  // Actions
  setCharacters: (characters: CharacterGuideData[]) => void
  setSelectedId: (id: string | null) => void
  getCharacterById: (id: string) => CharacterGuideData | undefined
  /** Add a new character (or update existing by id) */
  upsertCharacter: (character: CharacterGuideData) => void
  /** Remove a character by id */
  removeCharacter: (id: string) => CharacterGuideData | undefined
  /** Reset all data to static defaults */
  resetToDefaults: () => void
}

const STORAGE_KEY = 'cep-character-guide:v1'

export const useCharacterGuideStore = create<CharacterGuideState>()(
  persist(
    (set, get) => ({
      characters: characterGuideList as CharacterGuideData[],
      selectedId: null,

      setCharacters: (characters) => set({ characters }),

      setSelectedId: (id) => set({ selectedId: id }),

      getCharacterById: (id) => {
        return get().characters.find((c) => c.id === id)
      },

      upsertCharacter: (character) => {
        const { characters } = get()
        const index = characters.findIndex((c) => c.id === character.id)
        if (index >= 0) {
          const updated = [...characters]
          updated[index] = character
          set({ characters: updated })
        } else {
          set({ characters: [...characters, character] })
        }
      },

      removeCharacter: (id) => {
        const { characters } = get()
        const character = characters.find((c) => c.id === id)
        if (character) {
          set({ characters: characters.filter((c) => c.id !== id) })
        }
        return character
      },

      resetToDefaults: () => {
        set({
          characters: characterGuideList as CharacterGuideData[],
          selectedId: null,
        })
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only persist the characters array, not selectedId
      partialize: (state) => ({
        characters: state.characters,
      }),
      // Merge persisted data with static defaults
      merge: (persisted, current) => {
        const persistedData = persisted as Partial<CharacterGuideState>
        const persistedChars = persistedData.characters || []
        // Build map from persisted data
        const persistedMap = new Map(persistedChars.map((c: CharacterGuideData) => [c.id, c]))
        // Merge: use persisted data for existing IDs, keep static defaults for rest
        const merged = current.characters.map((c) => persistedMap.get(c.id) || c)
        // Add any new characters that exist only in persisted data
        for (const pc of persistedChars) {
          if (!merged.find((c) => c.id === pc.id)) {
            merged.push(pc)
          }
        }
        return {
          ...current,
          characters: merged,
        }
      },
    }
  )
)
