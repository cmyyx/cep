'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'

/** Color mapping for element types (matching project conventions) */
const ELEMENT_COLORS: Record<string, { bg: string; ring: string; label: string }> = {
  '物理': { bg: 'bg-amber-100 dark:bg-amber-900/30', ring: 'ring-amber-400', label: '物理' },
  '自然': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', ring: 'ring-emerald-400', label: '自然' },
  '寒冷': { bg: 'bg-sky-100 dark:bg-sky-900/30', ring: 'ring-sky-400', label: '寒冷' },
  '灼热': { bg: 'bg-red-100 dark:bg-red-900/30', ring: 'ring-red-400', label: '灼热' },
  '电磁': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', ring: 'ring-yellow-400', label: '电磁' },
}

export const ElementBadge = memo(function ElementBadge({
  element,
}: {
  element: string
}) {
  const colors = ELEMENT_COLORS[element]
  if (!colors) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
        {element}
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', colors.bg, 'px-2 py-0.5 rounded-full')}>
      <span className={cn('w-2 h-2 rounded-full', colors.ring, 'ring-2 ring-offset-0')} />
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

/** Small colored dot for element types (inline use) */
export const ElementDot = memo(function ElementDot({ element }: { element: string }) {
  const colors = ELEMENT_COLORS[element]
  const ringClass = colors?.ring ?? 'ring-muted-foreground/40'
  return <span className={cn('inline-block w-2.5 h-2.5 rounded-full ring-2 ring-offset-1', ringClass)} />
})
