'use client'

import { useState, type ReactNode } from 'react'
import Image, { type StaticImageData } from 'next/image'
import { cn } from '@/lib/utils'
import { getRarityBandSrc } from './rarity-stars'

export interface RarityFrameProps {
  imageSrc?: string | StaticImageData | null
  backgroundSrc?: string | StaticImageData
  title: string
  rarity?: number | null
  badges?: ReactNode
  className?: string
  imageClassName?: string
  badgeClassName?: string
  showTitle?: boolean
}

export function RarityFrame({
  imageSrc,
  backgroundSrc = '/images/item-frame-bg.png',
  title,
  rarity,
  badges,
  className,
  imageClassName,
  badgeClassName,
  showTitle = true,
}: RarityFrameProps) {
  const [failedImageSrc, setFailedImageSrc] = useState<string | StaticImageData | null | undefined>(null)
  const imageFailed = failedImageSrc === imageSrc
  const fallbackLabel = title.trim().charAt(0) || '?'

  return (
    <article
      data-testid="rarity-frame"
      className={cn(
        'relative aspect-square overflow-hidden rounded-lg shadow-[var(--shadow-border)]',
        className
      )}
    >
      <Image
        data-testid="rarity-frame-background"
        src={backgroundSrc}
        alt=""
        fill
        className="object-cover"
        unoptimized
      />
      {imageSrc && !imageFailed ? (
        <Image
          src={imageSrc}
          alt={title}
          fill
          className={cn('z-10 object-cover', imageClassName)}
          unoptimized
          onError={() => setFailedImageSrc(imageSrc)}
        />
      ) : (
        <span
          data-testid="rarity-frame-fallback"
          aria-hidden="true"
          className="absolute inset-0 z-10 flex items-center justify-center text-2xl font-semibold text-white/50"
        >
          {fallbackLabel}
        </span>
      )}
      <Image
        data-testid="rarity-frame-band"
        src={getRarityBandSrc(rarity)}
        alt=""
        width={200}
        height={40}
        className="pointer-events-none absolute -inset-x-px bottom-0 z-20 w-[calc(100%+2px)] max-w-none object-cover object-bottom"
        unoptimized
      />
      {badges ? <span className={cn('absolute left-2 top-2 z-30', badgeClassName)}>{badges}</span> : null}
      {showTitle ? (
        <h3 className="absolute inset-x-0 bottom-2 z-30 truncate px-2 text-center text-sm font-semibold leading-tight text-stone-100 drop-shadow-md">
          {title}
        </h3>
      ) : null}
    </article>
  )
}

export default RarityFrame
