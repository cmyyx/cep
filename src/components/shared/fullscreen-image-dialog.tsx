'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

export interface FullscreenImageDialogContentProps {
  src: string
  alt: string
  /** 无障碍标题 (sr-only)。 */
  title: string
  closeLabel: string
  /** 图片适配方式, 壁纸用 object-cover, 潜能图等用 object-contain。 */
  imageClassName?: string
  priority?: boolean
}

/**
 * 全屏图片预览的共享 DialogContent: 铺满视口、点击任意位置关闭、右上角保留 X。
 * 背景预览 (壁纸) 与 wiki 潜能图共用; 调用方自行提供 <Dialog> 与触发器。
 */
export function FullscreenImageDialogContent({
  src,
  alt,
  title,
  closeLabel,
  imageClassName = 'object-contain',
  priority,
}: FullscreenImageDialogContentProps) {
  return (
    <DialogContent
      showCloseButton={false}
      className="inset-0! size-full max-w-none! translate-x-0! translate-y-0! gap-0 rounded-none bg-black p-0 ring-0 sm:max-w-none"
    >
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <Image src={src} alt={alt} fill sizes="100vw" className={imageClassName} unoptimized priority={priority} />
      <DialogClose
        render={
          <button
            type="button"
            aria-label={closeLabel}
            className="absolute inset-0 size-full cursor-zoom-out bg-transparent"
          />
        }
      />
      <DialogClose
        render={
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-4 right-4 active:translate-y-0!"
            aria-label={closeLabel}
          />
        }
      >
        <X className="size-4" />
      </DialogClose>
    </DialogContent>
  )
}
