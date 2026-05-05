'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/zh-CN/essence-planner')
  }, [router])

  return null
}
