'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULT_SITE_URL } from '@/lib/constants'

const SiteUrlContext = createContext<string>(DEFAULT_SITE_URL)

export function SiteUrlProvider({ url, children }: { url: string; children: ReactNode }) {
  return <SiteUrlContext.Provider value={url}>{children}</SiteUrlContext.Provider>
}

export function useSiteUrl() {
  return useContext(SiteUrlContext)
}
