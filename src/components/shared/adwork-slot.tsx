'use client'

import { useEffect, useSyncExternalStore, type MouseEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AdSlot } from './ad-slot'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useShouldHideAds } from '@/hooks/use-should-hide-ads'
import { useAdPolling } from '@/hooks/use-ad-polling'
import { useAdStore } from '@/stores/useAdStore'
import { useAdworkStore } from '@/stores/useAdworkStore'
import { ADWORK_MODE, ADWORK_PLACEMENT_ID, reportPartnerAdEvent } from '@/lib/adwork'
import type { AdSlotName } from '@/types/ad'

export interface AdworkSlotProps {
  variant: AdSlotName
  className?: string
}

/**
 * How long a pending placement waits before the cloud ad replaces it. The SDK
 * has no timeout of its own; an ad blocker that answers with an empty 200, or a
 * stalled creative request, would otherwise leave the reserved area blank
 * forever.
 */
const ADWORK_FILL_TIMEOUT_MS = 15_000

/**
 * One Adwork placement.
 *
 * Only one instance is mounted at a time: the SDK aborts every placement on a
 * phone or tablet as soon as it sees an `adwork-300` container, and because
 * both slots share a data-id it would also fill the hidden one. The breakpoint
 * is therefore a mount condition, not a CSS class.
 *
 * The gate is a separate component so a visitor who never sees this slot (wrong
 * breakpoint, paid membership) does not subscribe to the ad stores or start the
 * cloud ad polling at all.
 */
export function AdworkSlot({ variant, className }: AdworkSlotProps) {
  const isMobile = useIsMobile()
  const hideAds = useShouldHideAds()
  // Server render is empty: the breakpoint is only known on the client, and an
  // ad container that appears after hydration cannot be server rendered anyway.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  if (!mounted || hideAds || (variant === 'mobile') !== isMobile) return null
  return <AdworkSlotBody variant={variant} className={className} />
}

function AdworkSlotBody({ variant, className }: AdworkSlotProps) {
  const t = useTranslations()
  const locale = useLocale()

  useAdPolling()
  const phase = useAdworkStore((s) => s.phases[variant])
  const dismissed = useAdworkStore((s) => s.dismissed[variant])
  const dismiss = useAdworkStore((s) => s.dismiss)
  const ad = useAdStore((s) => s.currentAd)

  useEffect(() => {
    const store = useAdworkStore.getState()
    store.activate(variant)
    // A fresh mount always starts pending: a resize across the breakpoint
    // creates a new container the SDK will not fill until the next route
    // change, and showing the old "loaded" state would leave an empty box.
    store.setPhase(variant, 'pending')
    const timer = window.setTimeout(() => {
      const current = useAdworkStore.getState()
      if (current.phases[variant] !== 'pending' && current.phases[variant] !== 'idle') return
      current.setPhase(variant, 'failed')
    }, ADWORK_FILL_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [variant])

  const isDesktop = variant === 'desktop'
  const fallbackAvailable =
    ad !== null && (isDesktop ? ad.desktopImageUrl !== null : ad.mobileImageUrl !== null)
  // `idle` only exists for the first frame between mount and the effect above;
  // it must render exactly like pending so no frame collapses the reserved box.
  const pending = phase === 'idle' || phase === 'pending'
  const failed = phase === 'failed'
  const showingFallback = failed && fallbackAvailable
  // On desktop the cloud creative keeps its 280:380 shape, so the fallback gets
  // the height the previous sidebar slot already reserved.
  const fallbackHeight = isDesktop && showingFallback ? 'h-[min(380px,32svh)] min-h-40' : ''
  const pendingHeight = pending ? (isDesktop ? 'min-h-[250px]' : 'min-h-[120px]') : ''

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof Element)) return
    // The SDK's own close button removes its container, which would leave the
    // route-change rescan with nothing to observe. It is hidden in CSS; this is
    // the keyboard/screen-reader guard.
    if (target.closest('.ad-close') !== null) {
      event.preventDefault()
      event.stopPropagation()
      dismiss(variant)
      return
    }
    const anchor = target.closest('a')
    if (anchor === null) return
    // The "广告" badge is SDK attribution, not the creative click.
    if (anchor.classList.contains('ad-badge')) return
    reportPartnerAdEvent('click', variant, window.location.pathname, locale)
  }

  return (
    <div
      data-cep-adwork=""
      className={cn(
        'relative',
        isDesktop ? 'w-[300px] max-w-full' : 'w-[320px] max-w-full',
        dismissed && 'hidden',
        className,
      )}
    >
      <div className={cn('relative flex w-full flex-col items-center', fallbackHeight, pendingHeight)}>
        <div
          className={cn('adwork-net adwork-auto w-full max-w-full', failed && 'hidden')}
          data-id={ADWORK_PLACEMENT_ID}
          data-placeholder="none"
          data-cep-adwork-slot={variant}
          data-mode={ADWORK_MODE === 'staging' ? 'staging' : undefined}
          onClickCapture={handleClickCapture}
        />

        {!dismissed && (phase === 'loaded' || showingFallback) ? (
          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            aria-label={t('ad.closeLabel')}
            className="absolute top-1 right-1 z-10 rounded-full opacity-90"
            onClick={() => dismiss(variant)}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}

        {!dismissed && pending ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            {t('ad.loading')}
          </span>
        ) : null}

        {!dismissed && showingFallback
          ? isDesktop
            ? (
                <div className="flex h-full w-full items-center justify-center">
                  <AdSlot variant="desktop" />
                </div>
              )
            : <AdSlot variant="mobile" />
          : null}

        {!dismissed && failed && !fallbackAvailable ? (
          <div className="flex flex-col items-center gap-1 px-3 py-4 text-center">
            <span className="text-xs font-medium text-muted-foreground">{t('ad.loadFailed')}</span>
            <span className="max-w-[280px] text-[11px] leading-relaxed text-muted-foreground">
              {t('ad.supportMessage')}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default AdworkSlot
