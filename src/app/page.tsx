'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SUPPORTED = ['zh-CN', 'zh-TW', 'ja', 'en'] as const

function detectLocale(): string {
  if (typeof window === 'undefined') return 'zh-CN'
  const browser = navigator.language
  if (SUPPORTED.includes(browser as typeof SUPPORTED[number])) return browser
  const prefix = browser.split('-')[0]
  const match = SUPPORTED.find(l => l.startsWith(prefix))
  return match ?? 'zh-CN'
}

export default function RootRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace(`/${detectLocale()}`)
  }, [router])

  return null
}
