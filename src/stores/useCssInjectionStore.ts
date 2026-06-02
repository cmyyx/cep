import { create } from 'zustand'

interface CssInjectionState {
  detected: boolean
  setDetected: () => void
}

export const useCssInjectionStore = create<CssInjectionState>((set) => ({
  detected: false,
  setDetected: () => set({ detected: true }),
}))
