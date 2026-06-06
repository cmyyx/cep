'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { Languages, Check } from 'lucide-react'
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar'
import { useSettingsStore } from '@/stores/useSettingsStore'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { detectBrowserLocale, buildLocaleHref } from '@/lib/locale-utils'

const LOCALES = ['zh-CN', 'zh-TW', 'ja', 'en'] as const

const LOCALE_LABELS: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  en: 'English',
}

export function LanguageSwitcher() {
  const urlLocale = useLocale()
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)

  const handleSwitch = useCallback(
    (value: string) => {
      if (value === 'auto') {
        setLanguage('auto')
        const detected = detectBrowserLocale()
        if (detected !== urlLocale) {
          window.location.href = buildLocaleHref(detected)
        }
      } else {
        const lang = value as 'zh-CN' | 'zh-TW' | 'ja' | 'en'
        setLanguage(lang)
        if (lang !== urlLocale) {
          window.location.href = buildLocaleHref(lang)
        }
      }
    },
    [urlLocale, setLanguage],
  )

  const { isMobile } = useSidebar()

  const detectedLocale = detectBrowserLocale()
  const sidebarLabel = LOCALE_LABELS[urlLocale] ?? urlLocale
  const sidebarTooltip =
    language === 'auto'
      ? sidebarLabel + ' AUTO'
      : sidebarLabel

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton tooltip={sidebarTooltip} />}>
        <Languages />
        <span>{sidebarLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={isMobile ? 'top' : 'right'}
        sideOffset={4}
        className="!w-auto min-w-36"
      >
        {/* AUTO option — follow browser */}
        <DropdownMenuItem
          onClick={() => handleSwitch('auto')}
          className="flex items-center justify-between"
        >
          <span>{LOCALE_LABELS[detectedLocale] + ' AUTO'}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {LOCALES.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleSwitch(loc)}
            className="flex items-center justify-between"
          >
            <span>{LOCALE_LABELS[loc]}</span>
            {loc === urlLocale && (
              <Check className="size-3.5 text-muted-foreground" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
