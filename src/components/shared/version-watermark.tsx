'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { useVersion } from '@/hooks/use-version'
import { useCssInjectionStore } from '@/stores/useCssInjectionStore'

export function VersionWatermark() {
  const t = useTranslations()
  const { info, localInfo } = useVersion()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const detected = useCssInjectionStore((s) => s.detected)

  const displayInfo = localInfo ?? info
  if (!displayInfo) return null

  const versionStr = displayInfo.version
  // suppress SSR hydration mismatch — only render after mount
  if (!mounted) return null

  return (
    <div className="absolute safe-area-watermark left-2 z-10 pointer-events-none">
      <span className="inline-block h-6 px-2 text-[10px] font-mono leading-6 text-muted-foreground/50 select-none">
        {versionStr}
        {detected && (
          <AlertTriangle
            className="inline-block w-3 h-3 ml-0.5 -mt-px text-amber-600/70 dark:text-amber-400/70"
            aria-label={t('versionWatermark.externalCssDetected')}
          />
        )}
      </span>
    </div>
  )
}
