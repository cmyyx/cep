'use client'

import { useEffect, useState } from 'react'

function formatTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function RealTimeClock() {
  const [time, setTime] = useState(() => formatTime(new Date()))

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined

    // Align to the next whole second for clean tick boundaries
    const msToNext = 1000 - new Date().getMilliseconds()
    const timeout = setTimeout(() => {
      setTime(formatTime(new Date()))
      interval = setInterval(() => setTime(formatTime(new Date())), 1000)
    }, msToNext)

    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [])

  return (
    <p className="text-4xl font-semibold tracking-[-2.4px] text-foreground tabular-nums">
      {time}
    </p>
  )
}
