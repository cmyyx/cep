'use client'

import { useSettingsStore } from '@/stores/useSettingsStore'
import { cn } from '@/lib/utils'

export function Background() {
  const { backgroundEnabled, backgroundBlur, backgroundUrl } = useSettingsStore()

  if (!backgroundEnabled) return null

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <img
        src={backgroundUrl}
        alt=""
        className={cn('size-full object-cover', backgroundBlur && 'blur-sm')}
      />
      <div className="absolute inset-0 bg-background/60" />
    </div>
  )
}
