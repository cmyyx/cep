import Image from 'next/image'
import { ImageOff } from 'lucide-react'
import type { ReactNode, SyntheticEvent } from 'react'
import { cn } from '@/lib/utils'

type WallpaperFrameTone = 'hero' | 'history'

export interface WallpaperMediaFrameProps {
  tone: WallpaperFrameTone
  aspectRatio: number
  failed: boolean
  imageUrl: string | null
  sizes: string
  unavailableLabel: string
  badge?: ReactNode
  loading?: 'eager' | 'lazy'
  onLoad: (event: SyntheticEvent<HTMLImageElement>) => void
  onError: () => void
}

export function WallpaperMediaFrame({
  tone,
  aspectRatio,
  failed,
  imageUrl,
  sizes,
  unavailableLabel,
  badge,
  loading,
  onLoad,
  onError,
}: WallpaperMediaFrameProps) {
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-muted',
        tone === 'hero'
          ? 'max-h-[min(42svh,16rem)] sm:max-h-[min(48svh,28rem)]'
          : 'max-h-[min(36svh,14rem)] sm:max-h-[min(32svh,16rem)]',
      )}
      style={{ aspectRatio: String(aspectRatio) }}
      data-aspect-ratio={aspectRatio.toFixed(4)}
    >
      {failed || !imageUrl ? (
        <div className="flex size-full min-h-24 flex-col items-center justify-center gap-1 text-muted-foreground">
          <ImageOff className="size-5" />
          <span className="text-xs">{unavailableLabel}</span>
        </div>
      ) : (
        <Image
          src={imageUrl}
          alt=""
          fill
          unoptimized
          loading={loading}
          sizes={sizes}
          className="object-cover"
          onLoad={onLoad}
          onError={onError}
        />
      )}
      {badge ? <div className="absolute top-2 left-2">{badge}</div> : null}
    </div>
  )
}

export default WallpaperMediaFrame
