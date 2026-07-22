'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { FEATURES } from '@/lib/features'
import {
  getAdOutcome,
  startAdAttempt,
  subscribeAdOutcome,
} from '@/lib/ad-telemetry'
import { useAuthStore } from '@/stores/useAuthStore'

type AdStatus = 'loading' | 'loaded' | 'error'

export function shouldHideAdsForUser(
  premiumUntil: string | null,
  premiumPreGrantedUntil: string | null,
  now: number,
): boolean {
  const premiumMs = premiumUntil ? Date.parse(premiumUntil) : 0
  const preGrantedMs = premiumPreGrantedUntil ? Date.parse(premiumPreGrantedUntil) : 0
  return (
    (Number.isFinite(premiumMs) && premiumMs > now) ||
    (Number.isFinite(preGrantedMs) && preGrantedMs > now)
  )
}

export function SidebarAd({ className }: { className?: string }) {
  const t = useTranslations()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const premiumUntil = useAuthStore((s) => s.premiumUntil)
  const premiumPreGrantedUntil = useAuthStore((s) => s.premiumPreGrantedUntil)
  const [eventStatus, setEventStatus] = useState<AdStatus>('loading')
  const outcome = useSyncExternalStore(
    subscribeAdOutcome,
    getAdOutcome,
    () => null,
  )
  const status = outcome ?? eventStatus
  // eslint-disable-next-line react-hooks/purity -- membership expiry check
  const now = Date.now()
  const hideAds =
    mounted && shouldHideAdsForUser(premiumUntil, premiumPreGrantedUntil, now)

  useEffect(() => {
    if (!FEATURES.ads || hideAds) return

    const onLoaded = () => setEventStatus('loaded')
    const onError = () => setEventStatus('error')
    window.addEventListener('cep:adwork-loaded', onLoaded)
    window.addEventListener('cep:adwork-error', onError)

    if (!outcome) startAdAttempt()

    return () => {
      window.removeEventListener('cep:adwork-loaded', onLoaded)
      window.removeEventListener('cep:adwork-error', onError)
    }
  }, [hideAds, outcome])

  if (!FEATURES.ads || hideAds) return null

  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-[300px]',
        'rounded-lg bg-muted/30 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)]',
        'overflow-hidden',
        status !== 'loaded' && 'min-h-[108px] md:min-h-[250px]',
        className,
      )}
    >
      <div
        className="adwork-net adwork-auto w-full"
        data-id="1110"
        data-placeholder="none"
      />
      {status !== 'loaded' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-muted/40 px-3 py-4 text-center backdrop-blur-[1px]">
          <span className="text-xs font-medium text-muted-foreground">
            {status === 'loading' ? t('ads.loading') : t('ads.loadFailed')}
          </span>
          {status === 'error' && (
            <span className="max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">
              {t('ads.supportMessage')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
