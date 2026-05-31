'use client'

import { createContext, useContext, type ReactNode } from 'react'

const SiteUrlContext = createContext<string>('https://end.canmoe.com')

export function SiteUrlProvider({ url, children }: { url: string; children: ReactNode }) {
  return <SiteUrlContext.Provider value={url}>{children}</SiteUrlContext.Provider>
}

export function useSiteUrl() {
  return useContext(SiteUrlContext)
}
