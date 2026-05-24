'use client'

import { useState, useMemo, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Cloud, Shield, Smartphone, Crown, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Turnstile, type TurnstileHandle } from '@/components/shared/turnstile'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useAuthStore } from '@/stores/useAuthStore'
import { getErrorI18nKey } from '@/lib/api'
import { getApiBaseUrl, getTurnstileSiteKey, isAuthAvailable, getDevOverrides, setDevOverrides, clearDevOverrides } from '@/lib/dev-api'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  login: z.string().min(1, { message: 'required' }),
  password: z.string().min(1, { message: 'required' }),
})

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, { message: 'usernameTooShort' })
      .max(24, { message: 'usernameTooLong' })
      .regex(/^[a-zA-Z0-9_]+$/, { message: 'usernameInvalidChars' }),
    email: z.string().email({ message: 'invalidEmail' }),
    password: z.string().min(6, { message: 'passwordTooShort' }).max(128),
    confirmPassword: z.string().min(1, { message: 'required' }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'passwordsNotMatch',
    path: ['confirmPassword'],
  })

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

function getPasswordStrength(password: string): { score: number; labelKey: string; color: string } {
  if (!password) return { score: 0, labelKey: '', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  if (score <= 1) return { score: 20, labelKey: 'strengthWeak', color: 'bg-destructive' }
  if (score <= 2) return { score: 40, labelKey: 'strengthFair', color: 'bg-orange-500' }
  if (score <= 3) return { score: 60, labelKey: 'strengthMedium', color: 'bg-yellow-500' }
  if (score <= 4) return { score: 80, labelKey: 'strengthStrong', color: 'bg-blue-500' }
  return { score: 100, labelKey: 'strengthVeryStrong', color: 'bg-green-500' }
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isExpired = searchParams.get('expired') === '1'

  const [isLogin, setIsLogin] = useState(true)
  const [resetMode, setResetMode] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const loginStore = useAuthStore((s) => s.login)
  const registerStore = useAuthStore((s) => s.register)
  const isLoading = useAuthStore((s) => s.isLoading)
  const clearLocalSession = useAuthStore((s) => s.clearLocalSession)
  const accessToken = useAuthStore((s) => s.accessToken)

  // Redirect to account page if already authenticated and auth is available
  useEffect(() => {
    if (isAuthAvailable() && accessToken) {
      router.replace(`/${locale}/account`)
    }
  }, [accessToken, locale, router])

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileHandle>(null)

  // Password reset
  const [resetStep, setResetStep] = useState<'email'|'code'>('email')
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const handleSendResetCode = async () => {
    if (!resetEmail) return
    setResetSending(true); setResetError(null)
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/password/send-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })
      if (!res.ok) { setResetError('sendResetFailed'); return }
      setResetStep('code')
    } catch {
      setResetError('sendResetFailed')
    } finally { setResetSending(false) }
  }

  const handleResetPassword = async () => {
    if (!resetCode || !resetNewPassword) return
    if (resetNewPassword.length < 6) { setResetError('passwordTooShort'); return }
    if (resetNewPassword !== resetConfirmPassword) { setResetError('passwordsNotMatch'); return }
    setResetSubmitting(true); setResetError(null)
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword: resetNewPassword }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'resetFailed') }
      setResetSent(true)
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'resetFailed')
    } finally { setResetSubmitting(false) }
  }

  const exitResetMode = () => {
    setResetMode(false); setResetStep('email'); setResetSent(false)
    setResetEmail(''); setResetCode(''); setResetNewPassword(''); setResetConfirmPassword('')
    setResetError(null)
  }

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: '', password: '' },
  })

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })

  const registerPassword = useWatch({ control: registerForm.control, name: 'password' })
  const passwordStrength = useMemo(() => getPasswordStrength(registerPassword ?? ''), [registerPassword])

  const switchMode = () => {
    setIsLogin(!isLogin)
    setServerError(null)
    setTurnstileToken(null)
    turnstileRef.current?.reset()
    loginForm.reset()
    registerForm.reset()
  }

  const onLoginSubmit = async (data: LoginForm) => {
    setServerError(null)
    try {
      await loginStore(data.login, data.password, turnstileToken)
      router.replace(`/${locale}/account`)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'loginFailed')
      setTurnstileToken(null)
      turnstileRef.current?.reset()
    }
  }

  const onRegisterSubmit = async (data: RegisterForm) => {
    setServerError(null)
    try {
      await registerStore(data.username, data.email, data.password, turnstileToken)
      router.replace(`/${locale}/account`)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'registerFailed')
      setTurnstileToken(null)
      turnstileRef.current?.reset()
    }
  }

  if (!isAuthAvailable()) {
    return <LoginUnavailableGuide />
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {isLogin ? t('nav.login') : t('nav.register')}
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-center min-h-full p-4">
          <div className="w-full max-w-sm py-8">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-[-0.48px] text-foreground">
            {t('app.name')}
          </h1>
        </div>

        {/* Expired banner */}
        {isExpired && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            <span>{t('account.sessionExpired')}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { clearLocalSession(); router.replace(`/${locale}/login`) }}
            >
              {t('account.clearSession')}
            </Button>
          </div>
        )}

        {resetMode ? (
          /* ── Reset Password ── */
          <>
            {resetSent ? (
              <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 space-y-3 text-center">
                <p>{t('auth.resetSuccess')}</p>
                <Button size="sm" className="w-full bg-white hover:bg-green-100 border-green-200" onClick={exitResetMode}>
                  {t('auth.backToLogin')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="text-center">
                  <h2 className="text-lg font-semibold tracking-[-0.36px]">{t('auth.forgotPassword')}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {resetStep === 'email' ? t('auth.forgotPasswordHint') : t('auth.enterResetCode')}
                  </p>
                </div>

                {resetStep === 'email' ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="reset-email">{t('auth.email')}</Label>
                      <Input id="reset-email" className="bg-card border-border" type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} />
                    </div>
                    {resetError && <p className="text-sm text-destructive text-center">{t(getErrorI18nKey(resetError))}</p>}
                    <Button className="w-full" onClick={handleSendResetCode} disabled={!resetEmail||resetSending}>
                      {resetSending?<Loader2 className="size-4 mr-2 animate-spin"/>:null}
                      {t('auth.sendResetCode')}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="reset-code">{t('auth.resetCode')}</Label>
                      <Input id="reset-code" className="bg-card border-border" value={resetCode} onChange={e=>setResetCode(e.target.value)} maxLength={6} placeholder="000000" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="reset-new-password">{t('auth.newPassword')}</Label>
                      <Input id="reset-new-password" className="bg-card border-border" type="password" value={resetNewPassword} onChange={e=>setResetNewPassword(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="reset-confirm">{t('auth.confirmPassword')}</Label>
                      <Input id="reset-confirm" className="bg-card border-border" type="password" value={resetConfirmPassword} onChange={e=>setResetConfirmPassword(e.target.value)} />
                    </div>
                    {resetError && <p className="text-sm text-destructive text-center">{t(getErrorI18nKey(resetError))}</p>}
                    <Button className="w-full" onClick={handleResetPassword} disabled={!resetCode||!resetNewPassword||resetSubmitting}>
                      {resetSubmitting?<Loader2 className="size-4 mr-2 animate-spin"/>:null}
                      {t('auth.resetPassword')}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">{t('auth.passwordChangeHint')}</p>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setResetStep('email')} disabled={resetSubmitting}>
                      {t('auth.resendResetCode')}
                    </Button>
                  </>
                )}

                <div className="text-center">
                  <Button type="button" variant="ghost" size="sm" onClick={exitResetMode}>
                    {t('auth.backToLogin')}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
        {/* Tabs */}
        <div className="mb-6 flex rounded-lg bg-muted p-0.5">
          <Button
            type="button"
            variant="ghost"
            onClick={switchMode}
            disabled={isLogin}
            className={cn(
              'flex-1 rounded-md py-2 h-auto text-sm font-medium transition-colors',
              isLogin
                ? 'bg-background text-foreground shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('nav.login')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={switchMode}
            disabled={!isLogin}
            className={cn(
              'flex-1 rounded-md py-2 h-auto text-sm font-medium transition-colors',
              !isLogin
                ? 'bg-background text-foreground shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('nav.register')}
          </Button>
        </div>

        {isLogin ? (
          <form onSubmit={(e) => loginForm.handleSubmit(onLoginSubmit)(e)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-input">{t('auth.usernameOrEmail')}</Label>
              <Input
                id="login-input"
                className="bg-card border-border"
                {...loginForm.register('login')}
              />
              {loginForm.formState.errors.login && (
                <p className="text-sm text-destructive">
                  {t(`auth.${loginForm.formState.errors.login.message}`)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">{t('auth.password')}</Label>
              <Input
                id="login-password"
                type="password"
                className="bg-card border-border"
                {...loginForm.register('password')}
              />
              {loginForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {t(`auth.${loginForm.formState.errors.password.message}`)}
                </p>
              )}
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

            {serverError && (
              <p className="text-sm text-destructive text-center">
                {t(getErrorI18nKey(serverError))}
              </p>
            )}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {t('account.syncing')}
                </>
              ) : (
                t('nav.login')
              )}
            </Button>
            <div className="text-center mt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setResetMode(true); setServerError(null); setTurnstileToken(null) }}
              >
                {t('auth.forgotPassword')}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => registerForm.handleSubmit(onRegisterSubmit)(e)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-username">{t('auth.username')}</Label>
              <Input
                id="reg-username"
                className="bg-card border-border"
                {...registerForm.register('username')}
              />
              {registerForm.formState.errors.username && (
                <p className="text-sm text-destructive">
                  {t(`auth.${registerForm.formState.errors.username.message}`)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-email">{t('auth.email')}</Label>
              <Input
                id="reg-email"
                type="email"
                className="bg-card border-border"
                {...registerForm.register('email')}
              />
              {registerForm.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {t(`auth.${registerForm.formState.errors.email.message}`)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-password">{t('auth.password')}</Label>
              <Input
                id="reg-password"
                type="password"
                className="bg-card border-border"
                {...registerForm.register('password')}
              />
              {registerForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {t(`auth.${registerForm.formState.errors.password.message}`)}
                </p>
              )}
              {registerPassword && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t('auth.passwordStrength')}</span>
                    <span
                      className={cn(
                        'font-medium',
                        passwordStrength.score <= 20 && 'text-destructive',
                        passwordStrength.score <= 40 && 'text-orange-500',
                        passwordStrength.score <= 60 && 'text-yellow-500',
                        passwordStrength.score <= 80 && 'text-blue-500',
                        passwordStrength.score > 80 && 'text-green-500',
                      )}
                    >
                      {passwordStrength.labelKey ? t(`auth.${passwordStrength.labelKey}`) : ''}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-300', passwordStrength.color)}
                      style={{ width: `${passwordStrength.score}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-confirm">{t('auth.confirmPassword')}</Label>
              <Input
                id="reg-confirm"
                type="password"
                className="bg-card border-border"
                {...registerForm.register('confirmPassword')}
              />
              {registerForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {t(`auth.${registerForm.formState.errors.confirmPassword.message}`)}
                </p>
              )}
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

            {serverError && (
              <p className="text-sm text-destructive text-center">
                {t(getErrorI18nKey(serverError))}
              </p>
            )}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {t('account.syncing')}
                </>
              ) : (
                t('nav.register')
              )}
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={switchMode}
            className="text-muted-foreground hover:text-foreground"
          >
            {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
          </Button>
        </p>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-border">
          <h2 className="text-sm font-semibold text-center mb-4">{t('auth.whyRegister')}</h2>
          <div className="space-y-2.5">
            {[
              { icon: Cloud, key: 'auth.benefitSync' },
              { icon: Smartphone, key: 'auth.benefitMultiDevice' },
              { icon: Shield, key: 'auth.benefitBackup' },
              { icon: Crown, key: 'auth.benefitPremium' },
            ].map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-start gap-2.5 text-sm">
                <Icon className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{t(key)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-border overflow-hidden">
            <Table className="text-[11px]">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-left px-3 py-1.5 h-auto">{t('account.feature')}</TableHead>
                  <TableHead className="text-center px-3 py-1.5 h-auto">Free</TableHead>
                  <TableHead className="text-center px-3 py-1.5 h-auto text-purple-600">Premium</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['account.featSyncSize', t('account.featSyncSizeFree'), t('account.featSyncSizePremium')],
                  ['account.featAutoSync', t('account.notSupported'), t('account.supported')],
                  ['account.featCustomWeapons', t('account.notSupported'), '300'],
                ].map(([label, free, premium]) => (
                  <TableRow key={label}>
                    <TableCell className="px-3 py-1.5 text-muted-foreground">{t(label)}</TableCell>
                    <TableCell className="px-3 py-1.5 text-center">{free}</TableCell>
                    <TableCell className="px-3 py-1.5 text-center text-purple-600 font-medium">{premium}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-3">{t('auth.registerHint')}</p>
        </div>
        </div>
      </div>
    </div>
  </div>
  )
}

function LoginUnavailableGuide() {
  const t = useTranslations()
  const [devClicks, setDevClicks] = useState(0)
  const [lastClickTime, setLastClickTime] = useState(0)
  const [showDevPanel, setShowDevPanel] = useState(false)
  const [devApiUrl, setDevApiUrl] = useState('')
  const [devTurnstileKey, setDevTurnstileKey] = useState('')

  useEffect(() => {
    const { apiUrl, turnstileKey } = getDevOverrides()
    setDevApiUrl(apiUrl)
    setDevTurnstileKey(turnstileKey)
  }, [])

  const handleCloudClick = () => {
    const now = Date.now()
    if (now - lastClickTime > 3000) {
      setDevClicks(1)
    } else {
      const n = devClicks + 1
      setDevClicks(n)
      if (n >= 5) {
        setShowDevPanel(true)
        setDevClicks(0)
      }
    }
    setLastClickTime(now)
  }

  const handleEnable = () => {
    setDevOverrides(devApiUrl, devTurnstileKey)
    window.location.reload()
  }

  const handleClear = () => {
    clearDevOverrides()
    window.location.reload()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">{t('auth.unavailableTitle')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-center min-h-full p-4">
          <div className="w-full max-w-sm py-8">
            <div className="mb-8 text-center">
              <Cloud
                className="size-10 mx-auto text-muted-foreground mb-3 cursor-default select-none"
                onClick={handleCloudClick}
              />
              <h1 className="text-xl font-semibold tracking-[-0.48px] text-foreground">
                {t('auth.unavailableTitle')}
              </h1>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                {t('auth.unavailableDescription')}
              </p>
            </div>

            {/* Dev panel — 5-click trigger */}
            {showDevPanel && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 mb-6">
                <h2 className="text-sm font-semibold mb-3 text-amber-800 dark:text-amber-200">Dev API 设置</h2>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="dev-api-url" className="text-xs text-amber-700 dark:text-amber-300">API Base URL</Label>
                    <Input
                      id="dev-api-url"
                      className="h-8 text-xs bg-white dark:bg-card border-amber-200 dark:border-amber-800"
                      placeholder="https://localhost:8787"
                      value={devApiUrl}
                      onChange={(e) => setDevApiUrl(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="dev-turnstile-key" className="text-xs text-amber-700 dark:text-amber-300">Turnstile Site Key</Label>
                    <Input
                      id="dev-turnstile-key"
                      className="h-8 text-xs bg-white dark:bg-card border-amber-200 dark:border-amber-800"
                      placeholder="1x00000000000000000000AA"
                      value={devTurnstileKey}
                      onChange={(e) => setDevTurnstileKey(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={handleEnable}>启用</Button>
                    <Button size="sm" variant="outline" onClick={handleClear}>清除</Button>
                  </div>
                </div>
              </div>
            )}

            {/* How to access */}
            <div className="rounded-lg border border-border bg-card p-4 mb-6">
              <h2 className="text-sm font-semibold mb-3">{t('auth.unavailableHowToAccess')}</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 text-sm">
                  <span className="shrink-0 size-5 rounded-full bg-muted inline-flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
                    1
                  </span>
                  <div className="flex-1">
                    <p className="text-foreground">{t('auth.unavailableOption1')}</p>
                      <a
                        href="https://end.canmoe.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-develop-blue hover:underline mt-0.5"
                      >
                        end.canmoe.com
                        <ExternalLink className="size-3" />
                      </a>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <span className="shrink-0 size-5 rounded-full bg-muted inline-flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
                    2
                  </span>
                  <div className="flex-1">
                    <p className="text-foreground">{t('auth.unavailableOption2')}</p>
                    <a
                      href="https://end.07070721.xyz"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-develop-blue hover:underline mt-0.5"
                    >
                      end.07070721.xyz
                      <ExternalLink className="size-3" />
                    </a>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('auth.unavailableOption2Note')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="pt-6 border-t border-border">
              <h2 className="text-sm font-semibold text-center mb-4">{t('auth.whyRegister')}</h2>
              <div className="space-y-2.5">
                {[
                  { icon: Cloud, key: 'auth.benefitSync' },
                  { icon: Smartphone, key: 'auth.benefitMultiDevice' },
                  { icon: Shield, key: 'auth.benefitBackup' },
                  { icon: Crown, key: 'auth.benefitPremium' },
                ].map(({ icon: Icon, key }) => (
                  <div key={key} className="flex items-start gap-2.5 text-sm">
                    <Icon className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{t(key)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-border overflow-hidden">
                <Table className="text-[11px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-left px-3 py-1.5 h-auto">{t('account.feature')}</TableHead>
                      <TableHead className="text-center px-3 py-1.5 h-auto">Free</TableHead>
                      <TableHead className="text-center px-3 py-1.5 h-auto text-purple-600">Premium</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ['account.featSyncSize', t('account.featSyncSizeFree'), t('account.featSyncSizePremium')],
                      ['account.featAutoSync', t('account.notSupported'), t('account.supported')],
                      ['account.featCustomWeapons', t('account.notSupported'), '300'],
                    ].map(([label, free, premium]) => (
                      <TableRow key={label}>
                        <TableCell className="px-3 py-1.5 text-muted-foreground">{t(label)}</TableCell>
                        <TableCell className="px-3 py-1.5 text-center">{free}</TableCell>
                        <TableCell className="px-3 py-1.5 text-center text-purple-600 font-medium">{premium}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-3">{t('auth.registerHint')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
