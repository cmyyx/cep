'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, LogIn, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Turnstile, type TurnstileHandle } from '@/components/shared/turnstile'
import { useAuthStore } from '@/stores/useAuthStore'
import { getTurnstileSiteKey } from '@/lib/dev-api'
import { getErrorI18nKey, api } from '@/lib/api'
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
const CLIENT_NAMES: Record<string, string> = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_OAUTH_CLIENT_NAMES || '{}'
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  } catch { /* ignore */ }
  return {}
})()

const loginSchema = z.object({
  login: z.string().min(1, { message: 'required' }),
  password: z.string().min(1, { message: 'required' }),
})

type LoginForm = z.infer<typeof loginSchema>

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
  const searchParams = useSearchParams()

  // OAuth parameters from the query string
  const clientId = searchParams.get('client_id') ?? ''
  const redirectUri = searchParams.get('redirect_uri') ?? ''
  const state = searchParams.get('state') ?? ''
  const scope = searchParams.get('scope') ?? ''

  // Auth state
  const accessToken = useAuthStore((s) => s.accessToken)
  const username = useAuthStore((s) => s.username)
  const isLoading = useAuthStore((s) => s.isLoading)
  const login = useAuthStore((s) => s.login)

  // UI state
  const [authorizing, setAuthorizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileHandle>(null)
  const isTurnstileConfigured = !!getTurnstileSiteKey()
  const turnstileBlocked = isTurnstileConfigured && !turnstileToken

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: '', password: '' },
  })

  const clientName = CLIENT_NAMES[clientId] || clientId || t('oauth.unknownClient')

  // Validate required OAuth parameters
  const missingParams = !clientId || !redirectUri

  // Derived: show login if authenticated session is missing
  const needsLogin = !missingParams && !accessToken

  // Redirect to external OAuth URLs via effect (avoids mutating window directly in handler)
  useEffect(() => {
    if (redirectUrl) {
      window.location.assign(redirectUrl)
    }
  }, [redirectUrl])

  // ── Handle login on the OAuth page ──────────────────────
  const onLoginSubmit = async (data: LoginForm) => {
    setServerError(null)
    try {
      await login(data.login, data.password, turnstileToken ?? '')
      // After successful login, the Zustand store updates accessToken.
      // needsLogin is derived, so it automatically becomes false on re-render.
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'loginFailed')
      setTurnstileToken(null)
      turnstileRef.current?.reset()
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
      setRedirectUrl(data.redirect_url)
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err ?? '')
      setError(t(getErrorI18nKey(code)))
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
    setRedirectUrl(`${redirectUri}?${params.toString()}`)
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

              <form onSubmit={(e) => loginForm.handleSubmit(onLoginSubmit)(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="oauth-login">{t('auth.usernameOrEmail')}</Label>
                  <Input
                    id="oauth-login"
                    className="bg-card border-border"
                    {...loginForm.register('login')}
                    disabled={loginForm.formState.isSubmitting}
                    autoFocus
                  />
                  {loginForm.formState.errors.login && (
                    <p className="text-sm text-destructive">
                      {t(`auth.${loginForm.formState.errors.login.message}`)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="oauth-password">{t('auth.password')}</Label>
                  <Input
                    id="oauth-password"
                    type="password"
                    className="bg-card border-border"
                    {...loginForm.register('password')}
                    disabled={loginForm.formState.isSubmitting}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {t(`auth.${loginForm.formState.errors.password.message}`)}
                    </p>
                  )}
                </div>

                {isTurnstileConfigured && (
                  <div className="flex flex-col gap-2">
                    <Label>{t('auth.turnstileLabel')}</Label>
                    <div className="flex justify-center">
                      <Turnstile
                        ref={turnstileRef}
                        siteKey={getTurnstileSiteKey()}
                        onVerify={setTurnstileToken}
                        onExpire={() => setTurnstileToken(null)}
                        loadingText={t('auth.turnstileLoading')}
                      />
                    </div>
                  </div>
                )}

                {serverError && (
                  <p className="text-sm text-destructive text-center">
                    {t(getErrorI18nKey(serverError))}
                  </p>
                )}

                <Button
                  className="w-full"
                  type="submit"
                  disabled={
                    !loginForm.formState.isValid ||
                    turnstileBlocked ||
                    loginForm.formState.isSubmitting
                  }
                >
                  {loginForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      {t('auth.loggingIn')}
                    </>
                  ) : (
                    t('nav.login')
                  )}
                </Button>
                {turnstileBlocked && !loginForm.formState.isSubmitting && (
                  <p className="text-xs text-muted-foreground text-center">
                    {t('auth.turnstileRequired')}
                  </p>
                )}
              </form>

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
                  <span className="font-medium text-foreground">{clientName}</span>
                  {t('oauth.authorizeDescription')}
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
                  {scope || t('oauth.defaultScopes')}
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
