'use client'

import { Languages, Check } from 'lucide-react'
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { detectBrowserLocale } from '@/lib/locale-utils'
import {
  LANGUAGE_OPTIONS,
  LANGUAGE_NATIVE_LABELS,
  getLanguageNativeLabel,
  useLanguageSwitch,
} from '@/hooks/use-language-switch'

export function LanguageSwitcher() {
  const { urlLocale, language, switchLanguage } = useLanguageSwitch()
  const { isMobile } = useSidebar()

  const detectedLocale = detectBrowserLocale()
  const sidebarLabel = getLanguageNativeLabel(urlLocale)
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
          onClick={() => switchLanguage('auto')}
          className="flex items-center justify-between"
        >
          <span>{LANGUAGE_NATIVE_LABELS[detectedLocale] + ' AUTO'}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {LANGUAGE_OPTIONS.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLanguage(loc)}
            className="flex items-center justify-between"
          >
            <span>{LANGUAGE_NATIVE_LABELS[loc]}</span>
            {loc === urlLocale && (
              <Check className="size-3.5 text-muted-foreground" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
