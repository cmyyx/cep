'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'

export type Rarity = 1 | 2 | 3 | 4 | 5 | 6

const RARITY_COLOR_CLASSES: Record<Rarity, string> = {
  1: 'text-rarity-1-star',
  2: 'text-rarity-2-star',
  3: 'text-rarity-3-star',
  4: 'text-rarity-4-star',
  5: 'text-rarity-5-star',
  6: 'text-rarity-6-star',
}

export function normalizeRarity(rarity: number | null | undefined): Rarity {
  return typeof rarity === 'number' && Number.isInteger(rarity) && rarity >= 1 && rarity <= 6
    ? (rarity as Rarity)
    : 1
}

export function getRarityColorClass(rarity: number | null | undefined): string {
  return RARITY_COLOR_CLASSES[normalizeRarity(rarity)]
}

export function getRarityBandSrc(rarity: number | null | undefined): string {
  return `/images/item-band-${normalizeRarity(rarity)}.png`
}

export interface RarityStarsProps {
  rarity?: number | null
  size?: 'sm' | 'md'
}

export const RarityStars = memo(function RarityStars({
  rarity,
  size = 'sm',
}: RarityStarsProps) {
  const count = normalizeRarity(rarity)
  const sizeClass = size === 'md' ? 'text-sm' : 'text-xs'
  const colorClass = getRarityColorClass(count)

  return (
    <span
      role="img"
      aria-label={`${count}★`}
      className={cn(
        'inline-flex gap-0.5 font-geist-mono tracking-tighter tabular-nums',
        sizeClass,
        colorClass
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <span key={index} data-slot="rarity-star" aria-hidden="true">
          &#9733;
        </span>
      ))}
      <span className="ml-1" aria-hidden="true">
        {count}
      </span>
    </span>
  )
})
