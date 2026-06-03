import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  loginApi,
  registerApi,
  logoutApi,
  getMeApi,
  getSessionsApi,
  revokeSessionApi,
  saveTokens,
  clearTokens,
  getTokens,
  ApiError,
  type SessionInfo,
  type RedeemHistoryItem,
} from '@/lib/api'
import { getDeviceName } from '@/lib/device'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  username: string | null
  email: string | null
  planTier: 'free' | 'premium'
  emailVerified: boolean
  premiumUntil: string | null
  premiumPreGrantedUntil: string | null
  premiumTrialUntil: string | null
  paymentClaims: Array<{id:number;channel:string;external_reference:string;merchant_order_no:string|null;note:string|null;status:string;paid_amount:string|null;plan_type:string|null;quantity:number;admin_note:string|null;submitted_at:string}>
  sessions: SessionInfo[]
  sessionsLoading: boolean
  redeemHistory: RedeemHistoryItem[]
  sessionExpired: boolean
  isLoading: boolean
  error: string | null

  login: (login: string, password: string, turnstileToken?: string | null) => Promise<void>
  register: (username: string, email: string, password: string, turnstileToken?: string | null) => Promise<void>
  logout: () => Promise<void>
  clearLocalSession: () => void
  fetchMe: () => Promise<void>
  fetchSessions: () => Promise<void>
  revokeSession: (sessionId: number) => Promise<void>
  clearError: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: typeof window !== 'undefined' ? getTokens().accessToken : null,
      refreshToken: typeof window !== 'undefined' ? getTokens().refreshToken : null,
      username: null,
      email: null,
      planTier: 'free',
      emailVerified: false,
      premiumUntil: null,
      premiumPreGrantedUntil: null,
      premiumTrialUntil: null,
      paymentClaims: [],
      sessions: [],
      sessionsLoading: false,
      redeemHistory: [],
      sessionExpired: false,
      isLoading: false,
      error: null,

      login: async (login, password, turnstileToken) => {
        set({ isLoading: true, error: null })
        try {
          const deviceName = getDeviceName()
          const res = await loginApi(login, password, turnstileToken, deviceName)
          saveTokens(res.accessToken, res.refreshToken)
          set({ accessToken: res.accessToken, refreshToken: res.refreshToken, username: res.username, sessionExpired: false, isLoading: false })
          get().fetchMe()
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'loginFailed', isLoading: false })
          throw err
        }
      },

      register: async (username, email, password, turnstileToken) => {
        set({ isLoading: true, error: null })
        try {
          const deviceName = getDeviceName()
          const res = await registerApi(username, email, password, turnstileToken, deviceName)
          saveTokens(res.accessToken, res.refreshToken)
          set({ accessToken: res.accessToken, refreshToken: res.refreshToken, username: res.username, email: res.email, sessionExpired: false, isLoading: false })
          get().fetchMe()
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'registerFailed', isLoading: false })
          throw err
        }
      },

      logout: async () => {
        await logoutApi()
        clearTokens()
        if (typeof window !== 'undefined') { try { localStorage.removeItem('cep-auth') } catch {}; try { localStorage.removeItem('cep-last-sync-sig') } catch {} }
        set({ accessToken: null, refreshToken: null, username: null, email: null, planTier: 'free', emailVerified: false, premiumUntil: null, premiumPreGrantedUntil: null, premiumTrialUntil: null, sessionExpired: false, error: null, sessions: [], redeemHistory: [] })
      },

      // Local-only session clear — no network request.
      // Used when user wants to dismiss the "session expired" state without logging in.
      clearLocalSession: () => {
        clearTokens()
        if (typeof window !== 'undefined') { try { localStorage.removeItem('cep-auth') } catch {}; try { localStorage.removeItem('cep-last-sync-sig') } catch {} }
        set({ accessToken: null, refreshToken: null, username: null, email: null, planTier: 'free', emailVerified: false, premiumUntil: null, premiumPreGrantedUntil: null, premiumTrialUntil: null, paymentClaims: [], sessions: [], sessionsLoading: false, redeemHistory: [], sessionExpired: false, error: null, isLoading: false })
      },

      fetchMe: async () => {
        const tokens = getTokens()
        if (!tokens.accessToken) return
        set({ sessionsLoading: true })
        try {
          const user = await getMeApi()
          set({ username: user.username, email: user.email, planTier: user.plan_tier, emailVerified: user.email_verified, premiumUntil: user.premium_until, premiumPreGrantedUntil: user.premium_pre_granted_until, premiumTrialUntil: user.premium_trial_until, paymentClaims: (user.payment_claims ?? []) as AuthState['paymentClaims'], sessions: (user.sessions ?? []) as AuthState['sessions'], redeemHistory: (user.redeem_history ?? []) as RedeemHistoryItem[], sessionsLoading: false, sessionExpired: false })
        } catch (err) {
          // Only clear session on definitive auth failures (401/403 from API after refresh was attempted).
          // Network errors and other transient issues should NOT nuke the session.
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            clearTokens()
            if (typeof window !== 'undefined') { try { localStorage.removeItem('cep-auth') } catch {}; try { localStorage.removeItem('cep-last-sync-sig') } catch {} }
            set({ accessToken: null, refreshToken: null, username: null, email: null, planTier: 'free', emailVerified: false, premiumUntil: null, premiumPreGrantedUntil: null, premiumTrialUntil: null, paymentClaims: [], sessions: [], sessionsLoading: false, redeemHistory: [], sessionExpired: true })
          }
          // On network errors, just leave the current state as-is — don't punish the user.
          set({ sessionsLoading: false })
        }
      },

      fetchSessions: async () => {
        set({ sessionsLoading: true })
        try {
          const res = await getSessionsApi()
          set({ sessions: res.sessions, sessionsLoading: false })
        } catch {
          set({ sessionsLoading: false })
        }
      },

      revokeSession: async (sessionId) => {
        try {
          await revokeSessionApi(sessionId)
        } catch (err) {
          // 404 means session already deleted — treat as success
          if (!(err instanceof ApiError && err.status === 404)) throw err
        }
        await get().fetchMe()
      },

      clearError: () => set({ error: null }),
      isAuthenticated: () => !!getTokens().accessToken,
    }),
    {
      name: 'cep-auth',
      merge: (persisted: unknown, current) => {
        const p = persisted as Record<string, unknown> | null
        if (!p) return current
        const result = { ...current }
        for (const key of Object.keys(current)) {
          if (key in (p as Record<string, unknown>)) {
            ;(result as Record<string, unknown>)[key] = (p as Record<string, unknown>)[key]
          }
        }
        return result
      },
      partialize: (state) => ({
        username: state.username, email: state.email, planTier: state.planTier,
        emailVerified: state.emailVerified, premiumUntil: state.premiumUntil, premiumPreGrantedUntil: state.premiumPreGrantedUntil, premiumTrialUntil: state.premiumTrialUntil,
      }),
    },
  ),
)
