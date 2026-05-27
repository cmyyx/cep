'use client'

import { useSyncExternalStore } from 'react'

function formatTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Stable placeholder used during SSR/hydration to avoid mismatch. */
const PLACEHOLDER_TIME = '--:--:--'

export function RealTimeClock() {
  // useSyncExternalStore: server snapshot is the placeholder (no Date()
  // during SSG), client snapshot is the real time. React handles the
  // transition from server→client without hydration errors.
  const time = useSyncExternalStore(
    (onStoreChange) => {
      let interval: ReturnType<typeof setInterval>
      // Align to the next whole second for clean tick boundaries
      const msToNext = 1000 - new Date().getMilliseconds()
      const timeout = setTimeout(() => {
        onStoreChange()
        interval = setInterval(onStoreChange, 1000)
      }, msToNext)
      return () => {
        clearTimeout(timeout)
        clearInterval(interval)
      }
    },
    () => formatTime(new Date()),
    () => PLACEHOLDER_TIME,
  )

  return (
    <p className="text-4xl font-semibold tracking-[-2.4px] text-foreground tabular-nums">
      {time}
    </p>
  )
}
