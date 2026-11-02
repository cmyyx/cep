'use client'

import { useLayoutEffect, useSyncExternalStore, type MouseEvent } from 'react'
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
 * How long a pending placement waits before it is treated as a load failure.
 * The SDK has no timeout of its own; a blocked script or a request that never
 * settles would otherwise leave the reserved area on "loading" forever. The
 * timeout uses the same prompt as a network error, including the allowlist
 * message, so a silently blocked request still gets the explanation.
 */
const ADWORK_FILL_TIMEOUT_MS = 15_000

/**
 * The SDK's `.adwork-auto` CSS is 300x250 above 1024px and 320x120 below it.
 * Reserve the same box in every phase: an empty placement, one the SDK hid for
 * `Blank`/`Disabled`, and a timed-out fill must not collapse the layout or shift
 * the sidebar and page content around.
 */
const SLOT_SIZE_CLASS: Record<AdSlotName, string> = {
  desktop: 'h-[120px] w-[300px] min-[1025px]:h-[250px]',
  mobile: 'h-[120px] w-[320px]',
}

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
  const unavailableReason = useAdworkStore((s) => s.unavailableReasons[variant])
  const dismissed = useAdworkStore((s) => s.dismissed[variant])
  const dismiss = useAdworkStore((s) => s.dismiss)
  const ad = useAdStore((s) => s.currentAd)

  // Layout effect, not passive: the SDK starts a 1ms poll for `.adwork-net` as
  // soon as it runs, and a response that beats the active-slot bookkeeping would
  // be attributed to nothing. This runs before the browser can schedule timers.
  useLayoutEffect(() => {
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
  const loaded = phase === 'loaded'
  const failed = phase === 'failed'
  const unavailable = phase === 'unavailable'
  // The cloud creative replaces a placement that failed to fill, not one the
  // network explicitly reported as empty (Blank/Disabled). In the latter case
  // the reserved slot stays in place and only its status text changes.
  const showingFallback = failed && fallbackAvailable
  const messageVisible = !showingFallback && (failed || unavailable)
  // Only the cloud creative needs an opaque surface; the status message leaves
  // the page background visible, exactly like the old empty-slot hint did.
  const fallbackSurface = isDesktop ? 'bg-sidebar' : 'bg-background'
  const unavailableMessage =
    unavailableReason === 'disabled' ? t('ad.slotDisabled') : t('ad.waitingForAds')

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
      data-cep-adwork-phase={phase}
      className={cn(
        'relative max-w-full',
        SLOT_SIZE_CLASS[variant],
        dismissed && 'hidden',
        className,
      )}
    >
      <div data-cep-adwork-box="" className="relative h-full w-full overflow-hidden">
        {/* Never put `hidden`/`display:none` on this node. The SDK only requests
            a creative once the placement intersects the viewport; a class-based
            hide survives the SDK's route rescan (it only clears inline styles),
            so every later /imp request would be skipped until a full reload. */}
        <div
          className="adwork-net adwork-auto w-full max-w-full"
          data-id={ADWORK_PLACEMENT_ID}
          data-placeholder="none"
          data-cep-adwork-slot={variant}
          data-mode={ADWORK_MODE === 'staging' ? 'staging' : undefined}
          onClickCapture={handleClickCapture}
        />

        {!dismissed && showingFallback ? (
          <div
            className={cn(
              'absolute inset-0 z-10 flex items-center justify-center',
              fallbackSurface,
            )}
          >
            <AdSlot variant={variant} />
          </div>
        ) : null}

        {!dismissed && messageVisible ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 px-3 text-center">
            {failed ? (
              <>
                <span className="text-xs font-medium text-muted-foreground">
                  {t('ad.loadFailed')}
                </span>
                <span className="max-w-[280px] text-[11px] leading-relaxed text-muted-foreground">
                  {t('ad.supportMessage')}
                </span>
              </>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">
                {unavailableMessage}
              </span>
            )}
          </div>
        ) : null}

        {!dismissed && pending ? (
          <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-xs text-muted-foreground">
            {t('ad.loading')}
          </span>
        ) : null}

        {!dismissed && (loaded || showingFallback) ? (
          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            aria-label={t('ad.closeLabel')}
            className="absolute top-1 right-1 z-20 rounded-full opacity-90"
            onClick={() => dismiss(variant)}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export default AdworkSlot
