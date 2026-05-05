import { create } from 'zustand'

interface SettingsState {
  backgroundEnabled: boolean
  backgroundBlur: boolean
  backgroundUrl: string
  theme: 'auto' | 'light' | 'dark' | 'flashbang'

  toggleBackground: () => void
  toggleBlur: () => void
  setBackgroundUrl: (url: string) => void
  restoreDefaultBg: () => void
  setTheme: (theme: 'auto' | 'light' | 'dark' | 'flashbang') => void
}

const DEFAULT_BG = 'https://img.canmoe.com/image?img=ua'

function loadSettings(): Partial<SettingsState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem('cep-settings')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {}
}

function saveSettings(state: SettingsState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('cep-settings', JSON.stringify({
      backgroundEnabled: state.backgroundEnabled,
      backgroundBlur: state.backgroundBlur,
      backgroundUrl: state.backgroundUrl,
      theme: state.theme,
    }))
  } catch { /* ignore */ }
}

const saved = loadSettings()

export const useSettingsStore = create<SettingsState>((set) => ({
  backgroundEnabled: saved.backgroundEnabled ?? true,
  backgroundBlur: saved.backgroundBlur ?? true,
  backgroundUrl: saved.backgroundUrl || DEFAULT_BG,
  theme: saved.theme || 'auto',

  toggleBackground: () =>
    set((s) => {
      const next = { ...s, backgroundEnabled: !s.backgroundEnabled }
      saveSettings(next as SettingsState)
      return { backgroundEnabled: next.backgroundEnabled }
    }),
  toggleBlur: () =>
    set((s) => {
      const next = { ...s, backgroundBlur: !s.backgroundBlur }
      saveSettings(next as SettingsState)
      return { backgroundBlur: next.backgroundBlur }
    }),
  setBackgroundUrl: (url: string) =>
    set((s) => {
      const next = { ...s, backgroundUrl: url }
      saveSettings(next as SettingsState)
      return { backgroundUrl: next.backgroundUrl }
    }),
  restoreDefaultBg: () =>
    set((s) => {
      const next = { ...s, backgroundUrl: DEFAULT_BG }
      saveSettings(next as SettingsState)
      return { backgroundUrl: next.backgroundUrl }
    }),
  setTheme: (theme) =>
    set((s) => {
      const next = { ...s, theme }
      saveSettings(next as SettingsState)
      return { theme: next.theme }
    }),
}))
