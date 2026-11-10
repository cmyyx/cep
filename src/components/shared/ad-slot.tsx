'use client'

import { useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { buildAdClickBeaconUrl, buildAdImpressionBeaconUrl } from '@/lib/ads'
import { AD_SLOT_BOX_CLASS } from '@/lib/ad-slot-spec'
import { useAdStore } from '@/stores/useAdStore'
import { useAdPolling } from '@/hooks/use-ad-polling'
import type { AdSlotName } from '@/types/ad'

export interface AdSlotProps {
  variant: AdSlotName
  /** 附加到广告根元素的外边距等；无广告时不生效。 */
  className?: string
}

/**
 * 盒位尺寸由 src/lib/ad-slot-spec.ts 统一描述（桌面 300x250、移动 320x120），
 * 换广告平台时只改那一处；素材按盒位等比裁切（object-cover）。
 */
const VARIANT_SIZE_CLASS: Record<AdSlotName, string> = AD_SLOT_BOX_CLASS

/**
 * 广告位。数据来自运营服务轮询（见 use-ad-polling）：
 * 无生效广告或该端无素材时整个组件不渲染、不占位；有 targetUrl 时整图为直链
 * （新标签页打开），点击瞬间用 navigator.sendBeacon 异步上报点击 —— 不经过
 * 后端中转跳转，也不阻塞新标签页。
 *
 * 展示上报以“素材 load 完成”为口径：每次挂载最多报一次，所以它衡量的是横幅
 * 实际被加载/显示了多次，不是“多少人看到”——去重是服务端按会话 id 与 IP 做的。
 * 服务端数素材拉取次数不可替代它：素材 URL 版本化且缓存一年，一台浏览器通常只拉一次。
 *
 * 素材为运营服务托管的图片（GIF / JPEG / PNG / WebP，含动图）—— next/image
 * 的优化管线会破坏 gif 动画且需要远程域名白名单，故使用原生 <img>（有
 * announcement-panel 先例）。
 */
export function AdSlot({ variant, className }: AdSlotProps) {
  useAdPolling()
  const t = useTranslations()
  const locale = useLocale()
  const ad = useAdStore((s) => s.currentAd)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const adId = ad?.id ?? null

  // 展示上报。hook 必须留在下面的提前 return 之前（React hooks 规则），
  // 因此这里只依赖 adId / variant / locale，无广告时直接不做事。
  useEffect(() => {
    const image = imageRef.current
    if (image === null || adId === null) return
    let reported = false
    const report = () => {
      if (reported) return
      reported = true
      if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return
      try {
        navigator.sendBeacon(buildAdImpressionBeaconUrl(adId, variant, window.location.pathname, locale))
      } catch {
        // 上报失败不影响渲染
      }
    }
    // 命中缓存时 load 可能早于本 effect 附加监听（React 在 DOM 插入后才跑 effect），
    // 因此先查 complete，再补监听；两条路径互斥，同一挂载周期不会重复上报。
    if (image.complete && image.naturalWidth > 0) {
      report()
      return
    }
    image.addEventListener('load', report)
    return () => image.removeEventListener('load', report)
  }, [adId, variant, locale])

  // 每端素材独立：该端没有素材时整个广告位不渲染、不占位。
  if (!ad || (variant === 'desktop' ? ad.desktopImageUrl : ad.mobileImageUrl) === null) return null

  const reportClick = (adId: number) => {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return
    try {
      navigator.sendBeacon(buildAdClickBeaconUrl(adId, variant, window.location.pathname, locale))
    } catch {
      // 上报失败不影响跳转
    }
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- 运营服务托管图片（含 gif 动图）必须绕过 next/image 优化（见组件注释）
    <img
      ref={imageRef}
      src={(variant === 'desktop' ? ad.desktopImageUrl : ad.mobileImageUrl) ?? ''}
      alt={ad.title.length > 0 ? ad.title : t('ad.imageAlt')}
      className="size-full rounded-[6px] object-cover"
      loading="lazy"
      decoding="async"
    />
  )

  const variantSize = cn(VARIANT_SIZE_CLASS[variant], variant === 'mobile' && 'max-w-full')

  if (ad.targetUrl) {
    return (
      <a
        href={ad.targetUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => reportClick(ad.id)}
        className={cn('block shrink-0 overflow-hidden rounded-[6px]', variantSize, className)}
      >
        {image}
      </a>
    )
  }

  return <div className={cn('shrink-0 overflow-hidden rounded-[6px]', variantSize, className)}>{image}</div>
}

export default AdSlot
