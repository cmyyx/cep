'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Languages } from 'lucide-react'
import { SidebarMenuButton } from '@/components/ui/sidebar'

const LOCALES = ['zh-CN', 'zh-TW', 'ja', 'en'] as const

const LOCALE_LABELS: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  en: 'English',
}

export function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()

  const handleClick = () => {
    const currentIndex = LOCALES.indexOf(locale as typeof LOCALES[number])
    const nextIndex = (currentIndex + 1) % LOCALES.length
    const newLocale = LOCALES[nextIndex]
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPath)
  }

  return (
    <SidebarMenuButton onClick={handleClick} tooltip={LOCALE_LABELS[locale]}>
      <Languages />
      <span>{LOCALE_LABELS[locale]}</span>
    </SidebarMenuButton>
  )
}
