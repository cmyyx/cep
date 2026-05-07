'use client'

import { useState, useCallback } from 'react'
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
  const [switchedLabel, setSwitchedLabel] = useState<string | null>(null)

  const getNextLocale = useCallback(() => {
    const currentIndex = LOCALES.indexOf(locale as typeof LOCALES[number])
    const nextIndex = (currentIndex + 1) % LOCALES.length
    return LOCALES[nextIndex]
  }, [locale])

  const handleSwitch = useCallback((newLocale: string) => {
    const label = LOCALE_LABELS[newLocale]
    setSwitchedLabel(label)
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPath)
    setTimeout(() => setSwitchedLabel(null), 2000)
  }, [pathname, locale, router])

  const nextLocale = getNextLocale()
  const nextLabel = LOCALE_LABELS[nextLocale]
  const tooltipText = switchedLabel
    ? `已切换到 ${switchedLabel}`
    : nextLabel

  return (
    <SidebarMenuButton
      onClick={() => handleSwitch(nextLocale)}
      tooltip={tooltipText}
    >
      <Languages />
      <span>{LOCALE_LABELS[locale]}</span>
    </SidebarMenuButton>
  )
}
