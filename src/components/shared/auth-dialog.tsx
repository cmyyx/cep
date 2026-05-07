'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/useAuthStore'

const loginSchema = z.object({
  login: z.string().min(1, 'required'),
  password: z.string().min(1, 'required'),
})

const registerSchema = z.object({
  username: z.string().min(1, 'required'),
  email: z.string().email('invalid_email'),
  password: z.string().min(6, 'min_length'),
  confirmPassword: z.string().min(1, 'required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'passwords_not_match',
  path: ['confirmPassword'],
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

function getPasswordStrength(password: string, t: (key: string) => string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  const checks = [
    { regex: /.{8,}/, label: '8位以上' },
    { regex: /[a-z]/, label: '小写字母' },
    { regex: /[A-Z]/, label: '大写字母' },
    { regex: /[0-9]/, label: '数字' },
    { regex: /[^a-zA-Z0-9]/, label: '特殊字符' },
  ]

  checks.forEach(check => {
    if (check.regex.test(password)) score++
  })

  if (score <= 1) return { score: 20, label: t('auth.strengthWeak'), color: 'bg-destructive' }
  if (score <= 2) return { score: 40, label: t('auth.strengthFair'), color: 'bg-orange-500' }
  if (score <= 3) return { score: 60, label: t('auth.strengthMedium'), color: 'bg-yellow-500' }
  if (score <= 4) return { score: 80, label: t('auth.strengthStrong'), color: 'bg-blue-500' }
  return { score: 100, label: t('auth.strengthVeryStrong'), color: 'bg-green-500' }
}

interface AuthDialogProps {
  showLabel?: boolean
}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export function AuthDialog({ showLabel = false }: AuthDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const { login: storeLogin, isLoading, error, clearError, username } = useAuthStore()
  const [serverError, setServerError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [height, setHeight] = useState<number | undefined>(undefined)
  const contentRef = useRef<HTMLDivElement>(null)

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const password = useWatch({ control: registerForm.control, name: 'password' })
  const passwordStrength = useMemo(() => getPasswordStrength(password || '', t), [password, t])

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [isLogin, password])

  const onLoginSubmit = async (data: LoginForm) => {
    setServerError(null)
    clearError()
    try {
      await storeLogin(data.login, data.password)
      setOpen(false)
      router.push('/zh-CN')
    } catch {
      setServerError('login_failed')
    }
  }

  const onRegisterSubmit = async (data: RegisterForm) => {
    setServerError(null)
    clearError()
    // TODO: 实现注册逻辑
    console.log('Register:', data)
  }

  const switchMode = () => {
    setIsLogin(!isLogin)
    setServerError(null)
    loginForm.reset()
    registerForm.reset()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate"
          />
        }
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
        <span>{username || t('auth.guestLogin')}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isLogin ? t('nav.login') : t('nav.register')}</DialogTitle>
        </DialogHeader>
        <div
          className="overflow-hidden transition-[height] duration-300 ease-in-out"
          style={{ height: height ? `${height}px` : 'auto' }}
        >
          <div ref={contentRef}>
            {isLogin ? (
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="login">{t('auth.usernameOrEmail')}</Label>
                  <Input id="login" {...loginForm.register('login')} />
                  {loginForm.formState.errors.login && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.login.message}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <Input id="password" type="password" {...loginForm.register('password')} />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>
                {(error || serverError) && (
                  <p className="text-sm text-destructive">{serverError || error}</p>
                )}
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '...' : t('nav.login')}
                </Button>
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('auth.noAccount')}
                </button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="username">{t('auth.username')}</Label>
                  <Input id="username" {...registerForm.register('username')} />
                  {registerForm.formState.errors.username && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.username.message}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input id="email" type="email" {...registerForm.register('email')} />
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="reg-password">{t('auth.password')}</Label>
                  <Input id="reg-password" type="password" {...registerForm.register('password')} />
                  {registerForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
                  )}
                  {password && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t('auth.passwordStrength')}</span>
                        <span className={`font-medium ${
                          passwordStrength.score <= 20 ? 'text-destructive' :
                          passwordStrength.score <= 40 ? 'text-orange-500' :
                          passwordStrength.score <= 60 ? 'text-yellow-500' :
                          passwordStrength.score <= 80 ? 'text-blue-500' :
                          'text-green-500'
                        }`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${passwordStrength.color} rounded-full transition-all duration-300 ease-in-out`}
                          style={{ width: `${passwordStrength.score}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password">{t('auth.confirmPassword')}</Label>
                  <Input id="confirm-password" type="password" {...registerForm.register('confirmPassword')} />
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
                {(error || serverError) && (
                  <p className="text-sm text-destructive">{serverError || error}</p>
                )}
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '...' : t('nav.register')}
                </Button>
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('auth.hasAccount')}
                </button>
              </form>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
