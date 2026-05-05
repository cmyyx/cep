'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function LocaleRootPage() {
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    router.replace(`/${params.locale}/essence-planner`)
  }, [router, params.locale])

  return null
}
