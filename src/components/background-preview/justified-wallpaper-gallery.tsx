'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import { ImageOff } from 'lucide-react'
import { DEFAULT_WALLPAPER_ASPECT_RATIO } from '@/lib/daily-wallpapers'
import type { WeeklyWallpaperItem } from '@/types/daily-wallpaper'

const TARGET_ROW_HEIGHT = 130
const GAP = 4
const SINGLE_IMAGE_MAX_HEIGHT = 320

interface JustifiedRowItem {
  item: WeeklyWallpaperItem
  width: number
}

interface JustifiedRow {
  items: JustifiedRowItem[]
  height: number
}

function computeJustifiedRows(
  items: WeeklyWallpaperItem[],
  aspectRatios: Record<string, number>,
  containerWidth: number,
): JustifiedRow[] {
  if (!containerWidth || items.length === 0) return []
  const targetHeight = TARGET_ROW_HEIGHT
  const rows: JustifiedRow[] = []
  let currentRow: Array<{ item: WeeklyWallpaperItem; ratio: number }> = []
  let currentRowRatios = 0

  for (const item of items) {
    const ratio = aspectRatios[item.id] ?? DEFAULT_WALLPAPER_ASPECT_RATIO
    currentRow.push({ item, ratio })
    currentRowRatios += ratio

    const rowWidth = currentRowRatios * targetHeight + GAP * (currentRow.length - 1)
    if (rowWidth >= containerWidth && currentRow.length > 1) {
      const height = (containerWidth - GAP * (currentRow.length - 1)) / currentRowRatios
      const rowItems = currentRow.map(({ item, ratio }) => ({ item, width: ratio * height }))
      rows.push({ items: rowItems, height })
      currentRow = []
      currentRowRatios = 0
    }
  }

  if (currentRow.length > 0) {
    if (rows.length === 0 && currentRow.length === 1) {
      const ratio = currentRow[0].ratio
      const height = Math.min(SINGLE_IMAGE_MAX_HEIGHT, containerWidth / ratio)
      rows.push({ items: [{ item: currentRow[0].item, width: ratio * height }], height })
    } else {
      const rowItems = currentRow.map(({ item, ratio }) => ({ item, width: ratio * targetHeight }))
      rows.push({ items: rowItems, height: targetHeight })
    }
  }

  return rows
}

export interface JustifiedWallpaperGalleryProps {
  items: WeeklyWallpaperItem[]
  aspectRatios: Record<string, number>
  failedImages: Set<string>
  sizes: string
  onLoad: (id: string, event: SyntheticEvent<HTMLImageElement>) => void
  onError: (id: string) => void
}

export function JustifiedWallpaperGallery({
  items,
  aspectRatios,
  failedImages,
  sizes,
  onLoad,
  onError,
}: JustifiedWallpaperGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const rows = useMemo(
    () => computeJustifiedRows(items, aspectRatios, containerWidth),
    [items, aspectRatios, containerWidth],
  )

  if (items.length === 0) return null

  return (
    <div ref={containerRef} className="flex flex-col overflow-y-auto overflow-x-hidden bg-muted gap-1 max-h-[min(42svh,16rem)] sm:max-h-[min(48svh,28rem)]">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1" style={{ height: `${row.height}px` }}>
          {row.items.map(({ item, width }) => {
            const failed = !item.imageUrl || failedImages.has(item.id)
            return (
              <div
                key={item.id}
                className="relative shrink-0 overflow-hidden"
                style={{ width: `${width}px`, height: `${row.height}px` }}
              >
                {failed || !item.imageUrl ? (
                  <div className="flex size-full min-h-20 items-center justify-center text-muted-foreground">
                    <ImageOff className="size-4" />
                  </div>
                ) : (
                  <Image
                    src={item.imageUrl}
                    alt=""
                    fill
                    unoptimized
                    loading="lazy"
                    sizes={sizes}
                    className="object-cover"
                    onLoad={(event) => onLoad(item.id, event)}
                    onError={() => onError(item.id)}
                  />
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default JustifiedWallpaperGallery
