'use client'

import { useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Cake, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { NavLink } from '@/components/shared/nav-link'
import { useBirthday } from '@/hooks/use-birthday'
import { getBirthdayNameSeparator } from '@/lib/operator-birthdays'

/**
 * Operator birthday banner — rides the same store and visual language as the
 * holiday banner (tone classes, dismiss flow, per-year dismissal via
 * `dismissedHolidays['birthday-{m}-{d}']`). Operators sharing a birthday are
 * merged into one banner; each name links to its wiki page.
 */
export function BirthdayBanner() {
  const { characterIds, dismiss } = useBirthday()
  const t = useTranslations()
  const locale = useLocale()
  const [exiting, setExiting] = useState(false)

  if (characterIds.length === 0) return null

  const handleDismiss = () => {
    setExiting(true)
    setTimeout(dismiss, 200)
  }

  const separator = getBirthdayNameSeparator(locale)
  const nameNodes: ReactNode[] = []
  characterIds.forEach((id, index) => {
    if (index > 0) {
      nameNodes.push(
        <span key={`sep-${index}`} aria-hidden="true">
          {separator}
        </span>
      )
    }
    nameNodes.push(
      <NavLink
        key={id}
        href={`/${locale}/wiki/characters/${id}`}
        loadingLabel={t(`characters.${id}`)}
        className="underline decoration-current underline-offset-2 hover:opacity-80"
      >
        {t(`characters.${id}`)}
      </NavLink>
    )
  })

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-medium',
        'shadow-[var(--shadow-border-inset-b)] transition-all duration-200',
        'bg-holiday-pink/10 text-holiday-pink dark:bg-holiday-pink-dark/10 dark:text-holiday-pink-dark',
        exiting && 'animate-toast-out opacity-0'
      )}
    >
      <Cake className="size-4 shrink-0" />
      <span>{t('birthday.prefix')}</span>
      {nameNodes}
      <span>{t('birthday.suffix')}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleDismiss}
        className="ml-1 opacity-70 hover:opacity-100"
        aria-label={t('common.close')}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
