import { create } from 'zustand'
import { loginApi, logoutApi, getMeApi } from '@/lib/api'

interface AuthState {
  token: string | null
  username: string | null
  isLoading: boolean
  error: string | null

  login: (login: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  username: null,
  isLoading: false,
  error: null,

  login: async (login: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const res = await loginApi(login, password)
      set({ token: res.token, username: res.username, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'login_failed'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  logout: async () => {
    const { token } = get()
    if (token) {
      try { await logoutApi(token) } catch { /* ignore */ }
    }
    set({ token: null, username: null, error: null })
  },

  fetchMe: async () => {
    const { token } = get()
    if (!token) return
    try {
      const user = await getMeApi(token)
      set({ username: user.username })
    } catch {
      set({ token: null, username: null })
    }
  },

  clearError: () => set({ error: null }),
}))
