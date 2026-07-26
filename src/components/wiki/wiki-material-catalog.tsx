'use client'

import { createContext, useContext, useMemo } from 'react'
import type { WikiMaterialCatalog } from '@/lib/wiki-material-compact'
import { expandWikiMaterials } from '@/lib/wiki-material-compact'

const WikiMaterialCatalogContext = createContext<WikiMaterialCatalog>({})

export function WikiMaterialCatalogProvider({
  catalog,
  children,
}: {
  catalog: WikiMaterialCatalog
  children: React.ReactNode
}) {
  const value = useMemo(() => catalog, [catalog])
  return (
    <WikiMaterialCatalogContext.Provider value={value}>
      {children}
    </WikiMaterialCatalogContext.Provider>
  )
}

export function useWikiMaterialCatalog(): WikiMaterialCatalog {
  return useContext(WikiMaterialCatalogContext)
}

export function useExpandedWikiMaterials(
  materials: Parameters<typeof expandWikiMaterials>[0],
) {
  const catalog = useWikiMaterialCatalog()
  return useMemo(() => expandWikiMaterials(materials, catalog), [catalog, materials])
}
