'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { PartyPopper, Gift, Cake, Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useHoliday } from '@/hooks/use-holiday'
import type { HolidayConfig } from '@/lib/holidays'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'party-popper': PartyPopper,
  gift: Gift,
  cake: Cake,
  star: Star,
}

function HolidayIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICON_MAP[icon]
  if (!Icon) return null
  return <Icon className={className} />
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function getRemainingSeconds(now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000))
}

function CountdownContent({ now, t }: { now: Date; t: ReturnType<typeof useTranslations> }) {
  const remaining = getRemainingSeconds(now)
  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = remaining % 60

  return (
    <>
      <span>{t('holiday.newYear.countdown')}</span>
      <span className="font-mono tabular-nums font-semibold tracking-wider">
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </>
  )
}

function NormalContent({
  config,
  yearText,
  t,
}: {
  config: HolidayConfig
  yearText: string
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <>
      <HolidayIcon icon={config.icon} className="size-4 shrink-0" />
      <span>
        {t(`${config.i18nKey}.banner`, { yearText })}
      </span>
    </>
  )
}

export function HolidayBanner() {
  const { activeHoliday, dismiss, now, yearText } = useHoliday()
  const t = useTranslations()
  const [exiting, setExiting] = useState(false)
  const prevHolidayRef = useRef<string | undefined>(undefined)

  const currentKey = activeHoliday
    ? `${activeHoliday.config.id}-${activeHoliday.phase}`
    : undefined

  if (prevHolidayRef.current !== currentKey) {
    prevHolidayRef.current = currentKey
    if (exiting) setExiting(false)
  }

  if (!activeHoliday) return null

  const { config, phase } = activeHoliday

  const handleDismiss = () => {
    setExiting(true)
    setTimeout(dismiss, 200)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-medium',
        'bg-develop-blue/10 border-b border-develop-blue/20 text-develop-blue',
        'transition-all duration-200',
        exiting && 'animate-toast-out opacity-0'
      )}
    >
      {phase === 'countdown' ? (
        <CountdownContent now={now} t={t} />
      ) : (
        <NormalContent config={config} yearText={yearText} t={t} />
      )}
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
