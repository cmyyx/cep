'use client'

import { useSettingsStore } from '@/stores/useSettingsStore'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Background() {
  const { backgroundEnabled, backgroundBlur, backgroundUrl } = useSettingsStore()

  if (!backgroundEnabled) return null

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <Image
        src={backgroundUrl}
        alt=""
        fill
        className={cn('object-cover', backgroundBlur && 'blur-sm')}
        unoptimized
      />
      <div className="absolute inset-0 bg-background/60" />
    </div>
  )
}
