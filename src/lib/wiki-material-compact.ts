import type { LocalizedText } from '@/types/wiki'
import { isLocalizedText, localizeText } from '@/lib/wiki-locale-detail'

export type WikiMaterialMeta = {
  name: string
  iconId: string
  rarity: number
}

export type WikiMaterialRef = {
  itemId: string
  count: number
}

export type WikiMaterialCatalog = Record<string, WikiMaterialMeta>

type MaterialLike = {
  itemId: string
  count: number
  iconId?: string
  rarity?: number
  name?: string | LocalizedText
}

function isMaterialLike(value: unknown): value is MaterialLike {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  return typeof obj.itemId === 'string' && typeof obj.count === 'number'
}

/**
 * Collapse repeated material objects to { itemId, count } refs + a shared catalog.
 * Call after toLocaleDetail so names are already single-locale strings.
 */
export function compactWikiMaterials<T>(value: T, locale = 'zh-CN'): {
  value: T
  catalog: WikiMaterialCatalog
} {
  const catalog: WikiMaterialCatalog = {}

  function visit(node: unknown): unknown {
    if (node == null || typeof node !== 'object') return node
    if (Array.isArray(node)) {
      if (node.length > 0 && isMaterialLike(node[0])) {
        return (node as MaterialLike[]).map((material) => {
          const existing = catalog[material.itemId]
          const name =
            typeof material.name === 'string'
              ? material.name
              : material.name
                ? localizeText(material.name, locale)
                : existing?.name ?? material.itemId
          catalog[material.itemId] = {
            name,
            iconId: material.iconId ?? existing?.iconId ?? material.itemId,
            rarity: material.rarity ?? existing?.rarity ?? 1,
          }
          return { itemId: material.itemId, count: material.count } satisfies WikiMaterialRef
        })
      }
      return node.map(visit)
    }
    if (isLocalizedText(node)) return node
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(node as Record<string, unknown>)) {
      out[key] = visit(entry)
    }
    return out
  }

  return { value: visit(value) as T, catalog }
}

/** Expand refs back to full material rows for UI components. */
export function expandWikiMaterials(
  materials: ReadonlyArray<MaterialLike | WikiMaterialRef> | undefined,
  catalog: WikiMaterialCatalog,
): Array<{ itemId: string; name: string; iconId: string; rarity: number; count: number }> {
  if (!materials?.length) return []
  return materials.map((material) => {
    const meta = catalog[material.itemId]
    const full = material as MaterialLike
    return {
      itemId: material.itemId,
      count: material.count,
      name:
        typeof full.name === 'string'
          ? full.name
          : full.name
            ? localizeText(full.name, 'zh-CN')
            : meta?.name ?? material.itemId,
      iconId: full.iconId ?? meta?.iconId ?? material.itemId,
      rarity: full.rarity ?? meta?.rarity ?? 1,
    }
  })
}
