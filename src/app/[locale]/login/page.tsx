'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/useAuthStore'

const loginSchema = z.object({
  login: z.string().min(1, 'required'),
  password: z.string().min(1, 'required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const t = useTranslations()
  const router = useRouter()
  const { login, login: storeLogin, isLoading, error, clearError } = useAuthStore()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setServerError(null)
    clearError()
    try {
      await storeLogin(data.login, data.password)
      router.push('/zh-CN/essence-planner')
    } catch {
      setServerError('login_failed')
    }
  }

  return (
    <div className="flex flex-col flex-1 p-6">
      <div className="flex items-center gap-2 mb-6">
        <SidebarTrigger />
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.login')}</h1>
      </div>
      <div className="flex flex-1 items-start justify-center pt-16">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{t('nav.login')}</CardTitle>
            <CardDescription>{t('home.title')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="login">{t('auth.usernameOrEmail')}</Label>
                <Input id="login" {...register('login')} />
                {errors.login && (
                  <p className="text-sm text-destructive">{errors.login.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input id="password" type="password" {...register('password')} />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
              {(error || serverError) && (
                <p className="text-sm text-destructive">{serverError || error}</p>
              )}
              <Button type="submit" disabled={isLoading}>
                {isLoading ? '...' : t('nav.login')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
