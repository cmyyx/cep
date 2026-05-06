'use client'

import { useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Languages } from 'lucide-react'
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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
  const { state } = useSidebar()
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

  if (state === 'collapsed') {
    const nextLocale = getNextLocale()
    const nextLabel = LOCALE_LABELS[nextLocale]
    const tooltipText = switchedLabel
      ? `已切换到 ${switchedLabel}`
      : nextLabel

    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => handleSwitch(nextLocale)}
              className="flex w-full items-center justify-center size-8 rounded-md p-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Languages className="size-4 shrink-0" />
            </button>
          }
        />
        <TooltipContent side="right">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <SidebarMenuButton
      onClick={() => handleSwitch(getNextLocale())}
      tooltip={LOCALE_LABELS[locale]}
    >
      <Languages />
      <span>{LOCALE_LABELS[locale]}</span>
    </SidebarMenuButton>
  )
}
