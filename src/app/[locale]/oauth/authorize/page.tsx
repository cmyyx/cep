'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, LogIn, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Turnstile, type TurnstileHandle } from '@/components/shared/turnstile'
import { useAuthStore } from '@/stores/useAuthStore'
import { getTurnstileSiteKey } from '@/lib/dev-api'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * OAuth2 Authorization Page.
 *
 * This page is the "consent screen" in the OAuth2 flow.
 * Users arrive here after clicking "Login with CEP" on a third-party site (e.g. NodeBB).
 *
 * Query parameters (from OAuth2 authorization request):
 *   client_id     — OAuth2 client identifier
 *   redirect_uri  — Where to send the user after authorization
 *   state         — CSRF token from the client
 *   scope         — Requested scopes (e.g. "profile email")
 */

// ── Client name mapping (can be extended) ──────────────────
const CLIENT_NAMES: Record<string, string> = {
  'nodebb-canmoe': 'NodeBB Forum',
  'nodebb-07070721': 'NodeBB Forum',
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense fallback={<OAuthLoading />}>
      <OAuthAuthorizeContent />
    </Suspense>
  )
}

function OAuthLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  )
}

function OAuthAuthorizeContent() {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()

  // OAuth parameters from the query string
  const clientId = searchParams.get('client_id') ?? ''
  const redirectUri = searchParams.get('redirect_uri') ?? ''
  const state = searchParams.get('state') ?? ''
  const scope = searchParams.get('scope') ?? ''

  // Auth state
  const accessToken = useAuthStore((s) => s.accessToken)
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const username = useAuthStore((s) => s.username)
  const isLoading = useAuthStore((s) => s.isLoading)
  const login = useAuthStore((s) => s.login)

  // UI state
  const [authorizing, setAuthorizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileHandle>(null)

  const clientName = CLIENT_NAMES[clientId] || clientId || t('oauth.unknownClient')

  // Validate required OAuth parameters
  const missingParams = !clientId || !redirectUri

  // Decide initial view
  useEffect(() => {
    if (missingParams) return
    if (!accessToken) {
      setNeedsLogin(true)
    }
  }, [accessToken, missingParams])

  // ── Handle login on the OAuth page ──────────────────────
  const handleLogin = async () => {
    if (!loginUsername || !loginPassword || !turnstileToken) return
    setLoginLoading(true)
    setLoginError(null)
    try {
      await login(loginUsername, loginPassword, turnstileToken)
      // After successful login, the Zustand store is updated.
      // The component re-renders and shows the consent view.
      setNeedsLogin(false)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'loginFailed')
      setTurnstileToken(null)
      turnstileRef.current?.reset()
    } finally {
      setLoginLoading(false)
    }
  }

  // ── Handle authorization ────────────────────────────────
  const handleAuthorize = async () => {
    if (!accessToken) return
    setAuthorizing(true)
    setError(null)

    try {
      const data = await api<{ redirect_url: string }>('/api/oauth/authorize', {
        method: 'POST',
        body: {
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
          scope,
        },
      })

      // Redirect to the OAuth callback (NodeBB)
      window.location.href = data.redirect_url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'authorization_failed')
      setAuthorizing(false)
    }
  }

  // ── Handle cancel ───────────────────────────────────────
  const handleCancel = () => {
    if (!redirectUri) return
    const params = new URLSearchParams()
    params.set('error', 'access_denied')
    params.set('error_description', 'The user denied the authorization request')
    if (state) {
      params.set('state', state)
    }
    window.location.href = `${redirectUri}?${params.toString()}`
  }

  // ── Missing parameters ──────────────────────────────────
  if (missingParams) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm text-center space-y-4">
            <ShieldAlert className="size-12 mx-auto text-destructive" />
            <h1 className="text-lg font-semibold">{t('oauth.invalidRequest')}</h1>
            <p className="text-sm text-muted-foreground">{t('oauth.missingParams')}</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Login required ──────────────────────────────────────
  if (needsLogin) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-center min-h-full p-4">
            <div className="w-full max-w-sm py-8 space-y-6">
              <div className="text-center space-y-2">
                <LogIn className="size-10 mx-auto text-muted-foreground" />
                <h1 className="text-xl font-semibold tracking-[-0.48px] text-foreground">
                  {t('oauth.loginRequired')}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t('oauth.loginRequiredHint', { client: clientName })}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="oauth-login">{t('auth.usernameOrEmail')}</Label>
                  <Input
                    id="oauth-login"
                    className="bg-card border-border"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    disabled={loginLoading}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="oauth-password">{t('auth.password')}</Label>
                  <Input
                    id="oauth-password"
                    type="password"
                    className="bg-card border-border"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loginLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLogin()
                    }}
                  />
                </div>

                {getTurnstileSiteKey() && (
                  <div className="flex justify-center">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={getTurnstileSiteKey()}
                      onVerify={setTurnstileToken}
                      onExpire={() => setTurnstileToken(null)}
                    />
                  </div>
                )}

                {loginError && (
                  <p className="text-sm text-destructive text-center">{loginError}</p>
                )}

                <Button
                  className="w-full"
                  onClick={handleLogin}
                  disabled={!loginUsername || !loginPassword || !turnstileToken || loginLoading}
                >
                  {loginLoading ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      {t('auth.loggingIn')}
                    </>
                  ) : (
                    t('nav.login')
                  )}
                </Button>
              </div>

              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="text-muted-foreground"
                >
                  {t('oauth.cancel')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Consent screen ──────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-center min-h-full p-4">
          <div className="w-full max-w-sm py-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center size-14 rounded-full bg-muted">
                <LogIn className="size-7 text-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-[-0.48px] text-foreground">
                  {t('oauth.authorizeTitle')}
                </h1>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {t.rich('oauth.authorizeDescription', {
                    client: () => <span className="font-medium text-foreground">{clientName}</span>,
                  })}
                </p>
              </div>
            </div>

            {/* User info summary */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('auth.username')}</span>
                <span className="font-medium text-foreground">{username}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('oauth.requestedScopes')}</span>
                <span className="font-medium text-foreground">
                  {scope || 'profile email'}
                </span>
              </div>
            </div>

            {/* Scope explanation */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t('oauth.scopeExplanation')}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t('oauth.scopeProfile')}</li>
                <li>{t('oauth.scopeEmail')}</li>
              </ul>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={handleAuthorize}
                disabled={authorizing || isLoading}
              >
                {authorizing ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {t('oauth.authorizing')}
                  </>
                ) : (
                  t('oauth.authorize')
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={handleCancel}
                disabled={authorizing}
              >
                {t('oauth.cancel')}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {t('oauth.privacyNote')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
