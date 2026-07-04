'use client'

import { memo } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { withImageCacheVersion } from '@/lib/image-url'

import type { Weapon } from '@/types/matrix'

export interface SelectedWeaponsStripProps {
  selectedIds: string[]
  weaponsMap: Map<string, Weapon>
  onToggleWeapon: (id: string) => void
  onViewAll?: () => void
}

export const SelectedWeaponsStrip = memo(function SelectedWeaponsStrip({
  selectedIds,
  weaponsMap,
  onToggleWeapon,
  onViewAll,
}: SelectedWeaponsStripProps) {
  const t = useTranslations()

  if (selectedIds.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 flex gap-1.5 overflow-x-auto pb-1 min-w-0">
        {selectedIds.map((id) => {
          const weapon = weaponsMap.get(id)
          if (!weapon) return null
          const wid = weapon.id
          const isCustom = wid.startsWith('custom-') || wid.startsWith('preview:')
          // 优先使用 iconId（游戏原始资源映射）
          const imageId = weapon.iconId ?? wid
          const imgSrc = isCustom ? undefined : withImageCacheVersion(`/images/weapon/${imageId}.avif`)
          const displayName = isCustom ? weapon.name : (t(`weapons.${wid}`) ?? weapon.name)

          return (
            <Button
              key={id}
              variant="ghost"
              size="xs"
              onClick={() => onToggleWeapon(id)}
              className="shrink-0 flex items-center gap-1 h-9 pr-1.5 pl-1 rounded-md border border-amber-400/30 bg-amber-400/[0.04] hover:bg-amber-400/10"
            >
              <div className="relative size-7 shrink-0 rounded overflow-hidden bg-[url(/images/item-frame-bg.png)] bg-cover bg-center">
                {imgSrc ? (
                  <Image
                    src={imgSrc}
                    alt={displayName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/40">
                    {weapon.name?.charAt(0) ?? '?'}
                  </span>
                )}
                <Image
                  src={withImageCacheVersion(`/images/item-band-${weapon.rarity}.png`)}
                  alt=""
                  width={100}
                  height={6}
                  className="absolute -inset-x-px bottom-0 z-10 w-[calc(100%+2px)] max-w-none object-cover object-bottom pointer-events-none"
                  unoptimized
                />
              </div>
              <span className="text-[11px] font-medium truncate max-w-14">
                {displayName}
              </span>
            </Button>
          )
        })}
      </div>
      {onViewAll && (
        <Button
          variant="ghost"
          size="xs"
          onClick={onViewAll}
          className="shrink-0 flex items-center gap-1 h-9 px-2 rounded-md border border-border text-[11px] text-muted-foreground hover:text-foreground"
        >
          <span>{t('essence.selectedList')}</span>
          <ChevronRight className="size-3" />
        </Button>
      )}
    </div>
  )
})
