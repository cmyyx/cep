'use client'

import Image from 'next/image'
import { withImageCacheVersion } from '@/lib/image-url'

/** Versioned local frame artwork used behind item and weapon cards. */
export function ItemFrameBackground() {
  return (
    <Image
      src={withImageCacheVersion('/images/item-frame-bg.png')}
      alt=""
      fill
      unoptimized
      className="pointer-events-none absolute inset-0 z-0 object-cover"
    />
  )
}

export default ItemFrameBackground
