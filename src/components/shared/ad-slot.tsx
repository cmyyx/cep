'use client'

import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { buildAdClickBeaconUrl } from '@/lib/ads'
import { useAdStore } from '@/stores/useAdStore'
import { useAdPolling } from '@/hooks/use-ad-polling'

export type AdSlotVariant = 'desktop' | 'mobile'

export interface AdSlotProps {
  variant: AdSlotVariant
  /** 附加到广告根元素的外边距等；无广告时不生效。 */
  className?: string
}

/**
 * 桌面侧边栏位 280x380（竖版）：高度由父容器决定（380px 起、可在空间不足时
 * 收缩，见 app-sidebar 的挂载容器），宽度按素材比例 280:380 等比跟随，
 * 素材完整展示不裁切；移动端顶部 banner 320x100（横版）为固定尺寸。
 */
const VARIANT_SIZE_CLASS: Record<AdSlotVariant, string> = {
  desktop: 'h-full w-auto aspect-[280/380]',
  mobile: 'h-[100px] w-[320px]',
}

/**
 * 广告位。数据来自运营服务轮询（见 use-ad-polling）：
 * 无生效广告或该端无素材时整个组件不渲染、不占位；有 targetUrl 时整图为直链
 * （新标签页打开），点击瞬间用 navigator.sendBeacon 异步上报点击 —— 不经过
 * 后端中转跳转，也不阻塞新标签页。
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

  // 每端素材独立：该端没有素材时整个广告位不渲染、不占位。
  if (!ad || (variant === 'desktop' ? ad.desktopImageUrl : ad.mobileImageUrl) === null) return null

  const reportClick = (adId: number) => {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return
    try {
      navigator.sendBeacon(buildAdClickBeaconUrl(adId, window.location.pathname, locale))
    } catch {
      // 上报失败不影响跳转
    }
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- 运营服务托管图片（含 gif 动图）必须绕过 next/image 优化（见组件注释）
    <img
      src={(variant === 'desktop' ? ad.desktopImageUrl : ad.mobileImageUrl) ?? ''}
      alt={ad.title.length > 0 ? ad.title : t('ad.imageAlt')}
      className="size-full rounded-[6px] object-cover"
      loading="lazy"
      decoding="async"
    />
  )

  if (ad.targetUrl) {
    return (
      <a
        href={ad.targetUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => reportClick(ad.id)}
        className={cn('block shrink-0 overflow-hidden rounded-[6px]', VARIANT_SIZE_CLASS[variant], className)}
      >
        {image}
      </a>
    )
  }

  return <div className={cn('shrink-0 overflow-hidden rounded-[6px]', VARIANT_SIZE_CLASS[variant], className)}>{image}</div>
}

export default AdSlot
