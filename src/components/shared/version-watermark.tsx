'use client'

import { useSyncExternalStore } from 'react'
import { useVersion } from '@/hooks/use-version'

export function VersionWatermark() {
  const { info, localInfo } = useVersion()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)

  const displayInfo = localInfo ?? info
  if (!displayInfo) return null

  const versionStr = displayInfo.version
  // suppress SSR hydration mismatch — only render after mount
  if (!mounted) return null

  return (
    <div className="absolute safe-area-watermark left-2 z-10 pointer-events-none">
      <span className="inline-block h-6 px-2 text-[10px] font-mono leading-6 text-muted-foreground/50 select-none">
        {versionStr}
      </span>
    </div>
  )
}
