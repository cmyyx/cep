import { create } from 'zustand'
import type { CharacterGuideData } from '@/types/character-guide'
import { characterGuideList } from '@/data/characters'

interface CharacterGuideState {
  /** All character guide data — always from static source data */
  characters: CharacterGuideData[]
  /** Currently selected character ID */
  selectedId: string | null

  // Actions
  setCharacters: (characters: CharacterGuideData[]) => void
  setSelectedId: (id: string | null) => void
  getCharacterById: (id: string) => CharacterGuideData | undefined
  upsertCharacter: (character: CharacterGuideData) => void
  removeCharacter: (id: string) => CharacterGuideData | undefined
  resetToDefaults: () => void
}

export const useCharacterGuideStore = create<CharacterGuideState>()(
  (set, get) => ({
    characters: characterGuideList,
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
        characters: characterGuideList,
        selectedId: null,
      })
    },
  })
)
