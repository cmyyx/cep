'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'

/** Simple element text display — no special colors or decoration */
export const ElementBadge = memo(function ElementBadge({
  element,
}: {
  element: string
}) {
  return (
    <span className="text-sm text-muted-foreground">
      {element}
    </span>
  )
})

/** Rarity stars display (1–6) */
export const RarityStars = memo(function RarityStars({
  rarity,
  size = 'sm',
}: {
  rarity: number
  size?: 'sm' | 'md'
}) {
  const stars = Array.from({ length: rarity }, (_, i) => i + 1)
  const sizeClass = size === 'md' ? 'text-sm' : 'text-xs'
  const colorClass = rarity >= 6 ? 'text-rarity-6-star' : 'text-rarity-5-star'
  return (
    <span className={cn('inline-flex gap-0.5 font-geist-mono tracking-tighter tabular-nums', sizeClass, colorClass)}>
      {stars.map((s) => (
        <span key={s}>
          &#9733;
        </span>
      ))}
      <span className="ml-1">{rarity}</span>
    </span>
  )
})
