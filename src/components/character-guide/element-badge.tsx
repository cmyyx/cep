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
  const color = rarity >= 6 ? '#ff7100' : '#ffcc00'
  return (
    <span className={cn('inline-flex gap-0.5 font-geist-mono tracking-tighter tabular-nums', sizeClass)}>
      {stars.map((s) => (
        <span key={s} style={{ color }}>
          &#9733;
        </span>
      ))}
      <span className="ml-1" style={{ color }}>{rarity}</span>
    </span>
  )
})
