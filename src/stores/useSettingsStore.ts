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
  hydrateFromStorage: () => void
}

const DEFAULT_BG = 'https://img.canmoe.com/image?img=ua'

const DEFAULTS = {
  backgroundEnabled: true,
  backgroundBlur: true,
  backgroundUrl: DEFAULT_BG,
  theme: 'auto' as const,
}

function loadSettings() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('cep-settings')
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore corrupt data */
  }
  return null
}

function saveSettings(state: SettingsState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      'cep-settings',
      JSON.stringify({
        backgroundEnabled: state.backgroundEnabled,
        backgroundBlur: state.backgroundBlur,
        backgroundUrl: state.backgroundUrl,
        theme: state.theme,
      })
    )
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Settings store with SSR-safe initialization.
 *
 * The store always starts with hardcoded defaults so the SSG HTML
 * and the first client render are identical (no hydration mismatch).
 * User preferences are loaded from localStorage via `hydrateFromStorage()`
 * which must be called inside a `useEffect` after mount.
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULTS,

  hydrateFromStorage: () => {
    const saved = loadSettings()
    if (saved) {
      const allowedThemes: SettingsState['theme'][] = ['auto', 'light', 'dark', 'flashbang']
      const theme = allowedThemes.includes(saved.theme) ? saved.theme : DEFAULTS.theme
      set({
        backgroundEnabled: saved.backgroundEnabled ?? DEFAULTS.backgroundEnabled,
        backgroundBlur: saved.backgroundBlur ?? DEFAULTS.backgroundBlur,
        backgroundUrl: saved.backgroundUrl || DEFAULTS.backgroundUrl,
        theme,
      })
    }
  },

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
