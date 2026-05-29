'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'cep-forum-warning-dismissed'

function isDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function setDismissed() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // ignore
  }
}

export function EmbedWarningBanner() {
  const t = useTranslations()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (isDismissed()) setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 px-4 py-2.5 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.06)] shrink-0',
        'bg-blue-50/60 text-sm text-blue-800'
      )}
    >
      <Info className="size-4 shrink-0 mt-0.5 text-blue-500" aria-hidden="true" />
      <p className="flex-1 min-w-0 leading-relaxed">
        {t('forum.embedWarning')}
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 -mr-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100/60"
        onClick={() => {
          setDismissed()
          setVisible(false)
        }}
        aria-label={t('common.close')}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
