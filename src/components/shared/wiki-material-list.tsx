'use client'

import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import { withImageCacheVersion } from '@/lib/image-url'
import { RarityFrame } from '@/components/shared/rarity-frame'
import type { WikiLocale, WikiMaterial } from '@/types/wiki'

export function formatMaterialCount(count: number): string {
  if (count < 1000) return String(count)
  return `${Number((count / 1000).toFixed(1))}k`
}

export interface WikiMaterialListProps {
  materials: WikiMaterial[]
  compact?: boolean
  iconOnly?: boolean
  className?: string
}

export function WikiMaterialList({ materials, compact = false, iconOnly = false, className }: WikiMaterialListProps) {
  const locale = useLocale() as WikiLocale

  return (
    <div className={cn('flex min-w-0 flex-wrap gap-3', className)}>
      {materials.map((material) => {
        const name = material.name[locale] || material.name['zh-CN'] || material.itemId
        return (
          <div key={`${material.itemId}-${material.count}`} className={cn('flex min-w-0', iconOnly ? 'flex-col items-center gap-0.5' : 'items-center gap-2')} title={iconOnly ? name : undefined}>
            <RarityFrame
              imageSrc={withImageCacheVersion(`/images/items/${material.iconId}.avif`)}
              title={name}
              rarity={material.rarity}
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
