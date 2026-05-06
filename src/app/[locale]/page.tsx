'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'

function getGreeting(): string {
  const hour = new Date().getHours()

  if (hour >= 0 && hour < 5) {
    return '夜深了，星星都困得眨眼啦，要注意早点休息哦，别熬夜太晚，身体才是最重要的。'
  }
  if (hour >= 5 && hour < 9) {
    return '早上好，新的一天开始啦，愿你元气满满！'
  }
  if (hour >= 11 && hour < 13) {
    return '中午好，记得按时吃饭，别饿着自己哦。'
  }
  if (hour >= 13 && hour < 18) {
    return '下午好，困了就去喝杯水，伸个懒腰，打起精神继续冲。'
  }
  return '夜晚温柔，愿你卸下疲惫，安心享受属于自己的时间。'
}

export default function HomePage() {
  const t = useTranslations()
  const greeting = useMemo(() => getGreeting(), [])

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-3rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          欢迎使用
        </h1>
      </div>

      {/* Main content */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col gap-2 text-center">
          <p className="text-lg text-muted-foreground">
            {greeting}
          </p>
        </div>
      </div>
    </div>
  )
}
