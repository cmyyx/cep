'use client'

import { cn } from '@/lib/utils'
import { withImageCacheVersion } from '@/lib/image-url'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import { useExpandedWikiMaterials } from '@/components/wiki/wiki-material-catalog'
import { localizeText } from '@/lib/wiki-locale-detail'
import { useLocale } from 'next-intl'
import type { LocalizedText } from '@/types/wiki'

export function formatMaterialCount(count: number): string {
  if (count < 1000) return String(count)
  return `${Number((count / 1000).toFixed(1))}k`
}

type MaterialView = {
  itemId: string
  count: number
  name?: string | LocalizedText
  iconId?: string
  rarity?: number
}

export interface WikiMaterialListProps {
  materials: MaterialView[]
  compact?: boolean
  iconOnly?: boolean
  className?: string
}

export function WikiMaterialList({ materials, compact = false, iconOnly = false, className }: WikiMaterialListProps) {
  const locale = useLocale()
  const { itemName } = useWikiTranslations()
  // Expand compact {itemId,count} refs when a page-level material catalog is present.
  const expanded = useExpandedWikiMaterials(materials)
  const rows = materials.some((m) => m.iconId == null || m.rarity == null || m.name == null) ? expanded : materials

  return (
    <div className={cn('flex min-w-0 flex-wrap gap-3', className)}>
      {rows.map((material) => {
        const name = material.name
          ? localizeText(material.name, locale)
          : itemName(material.itemId)
        const iconId = material.iconId ?? material.itemId
        const rarity = material.rarity ?? 1
        return (
          <div key={`${material.itemId}-${material.count}`} className={cn('flex min-w-0', iconOnly ? 'flex-col items-center gap-0.5' : 'items-center gap-2')} title={iconOnly ? name : undefined}>
            <RarityFrame
              imageSrc={withImageCacheVersion(`/images/items/${iconId}.avif`)}
              title={name}
              rarity={rarity}
              showTitle={false}
              imageClassName="object-contain p-1"
              className={cn('shrink-0 rounded-md', compact ? 'size-10' : 'size-12')}
            />
            {iconOnly ? (
              <span className="font-geist-mono text-[11px] text-muted-foreground">×{formatMaterialCount(material.count)}</span>
            ) : (
              <span className="min-w-0">
                <span className={cn('block truncate font-medium', compact ? 'max-w-28 text-[11px]' : 'max-w-36 text-xs')}>{name}</span>
                <span className="block font-geist-mono text-xs text-muted-foreground">×{formatMaterialCount(material.count)}</span>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default WikiMaterialList
