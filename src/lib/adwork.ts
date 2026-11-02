import { OPS_SERVICE_ORIGIN } from '@/lib/constants'
import { getAdSessionId } from '@/lib/ads'
import type { AdSlotName } from '@/types/ad'

/** Third-party ad network script. Loaded once, from the locale layout. */
export const ADWORK_SDK_URL = 'https://cdn.adwork.net/js/makemoney.js'

/**
 * Adwork placement id (the `data-id` of the container). Both the mobile banner
 * and the desktop sidebar use it: the SDK sends one request per id with the
 * sizes of the mounted containers, and `adwork-auto` picks 320x120 below
 * 1024px and 300x250 above it.
 */
export const ADWORK_PLACEMENT_ID = '1110'

export type AdworkMode = 'production' | 'staging'

/**
 * Resolve the `data-mode` of the container. Staging renders placeholder
 * creatives and must never reach a production build, so the default follows
 * NODE_ENV: `next dev` is staging, `next build` is production. An explicit
 * NEXT_PUBLIC_ADWORK_MODE wins, which lets a preview build exercise staging.
 */
export function resolveAdworkMode(explicit: string | undefined, nodeEnv: string | undefined): AdworkMode {
  if (explicit === 'production' || explicit === 'staging') return explicit
  return nodeEnv === 'production' ? 'production' : 'staging'
}

export const ADWORK_MODE: AdworkMode = resolveAdworkMode(
  process.env.NEXT_PUBLIC_ADWORK_MODE,
  process.env.NODE_ENV,
)

export type PartnerAdEventName = 'impression' | 'click'

/**
 * Staging placements render the network's own placeholder creative, not a real
 * ad. Counting those fills would write phantom rows into the partner tables, so
 * only a production build reports.
 */
export function shouldReportPartnerEvents(mode: AdworkMode): boolean {
  return mode === 'production'
}

/**
 * Build the beacon URL of one partner event. Partner placements have no row in
 * the ops advertisement table, so they use their own route and table; the
 * payload is bodyless like the native beacons, which keeps the cross-origin
 * report a simple request (no CORS preflight).
 *
 * The session id is only meaningful for impressions: clicks are deduplicated
 * by IP hash, exactly like the native click table.
 */
export function buildPartnerAdEventUrl(
  event: PartnerAdEventName,
  slot: AdSlotName,
  path: string,
  locale: string,
): string {
  const params = new URLSearchParams({ slot, path, locale })
  if (event === 'impression') {
    const sessionId = getAdSessionId()
    if (sessionId !== '') params.set('sid', sessionId)
  }
  return `${OPS_SERVICE_ORIGIN}/api/v1/partners/adwork/${ADWORK_PLACEMENT_ID}/${event}?${params.toString()}`
}

/**
 * Report one partner event. Statistics must never affect rendering or the
 * click itself, so every failure is swallowed.
 */
export function reportPartnerAdEvent(
  event: PartnerAdEventName,
  slot: AdSlotName,
  path: string,
  locale: string,
): void {
  if (!shouldReportPartnerEvents(ADWORK_MODE)) return
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return
  try {
    navigator.sendBeacon(buildPartnerAdEventUrl(event, slot, path, locale))
  } catch {
    // Reporting is best effort.
  }
}

/** The SDK-reported creative handle. Only `element` is used. */
export interface AdworkAdHandle {
  element?: HTMLElement
}

export interface AdworkError {
  id?: string
  code?: string
  message?: string
}

export type AdworkUnavailableReason = 'blank' | 'disabled'

/**
 * What an SDK media callback means for the UI.
 *
 * `Blank` and `Disabled` are successful `/imp` responses that carry no
 * creative: the code is installed and waiting for review / has no matching ad,
 * or the site is not enrolled. Treating them as a load failure would ask a
 * visitor to whitelist us for an ad that does not exist yet. `NetworkError`
 * (and any unknown code) is the only outcome that gets the blocker message.
 */
export type AdworkErrorOutcome =
  | { status: 'unavailable'; reason: AdworkUnavailableReason }
  | { status: 'failed' }

export function classifyAdworkError(code: string | undefined): AdworkErrorOutcome {
  if (code === 'Blank') return { status: 'unavailable', reason: 'blank' }
  if (code === 'Disabled') return { status: 'unavailable', reason: 'disabled' }
  return { status: 'failed' }
}

declare global {
  interface Window {
    adwork?: {
      onLoaded(ad: AdworkAdHandle): void
      onError(error: AdworkError): void
    }
  }
}

/**
 * Map a filled container back to the slot that mounted it. The SDK reports the
 * element, not the placement, and both slots share one data-id; the attribute
 * is what keeps the two slots apart.
 */
export function adworkSlotFromElement(element: HTMLElement | null | undefined): AdSlotName | null {
  const slot = element?.getAttribute('data-cep-adwork-slot')
  return slot === 'desktop' || slot === 'mobile' ? slot : null
}

/**
 * Derive the locale segment from a pathname. The SDK callbacks run outside
 * React, where `useLocale` is unavailable, and a stale closure would report the
 * wrong locale after a hard locale switch. `/zh-CN/planner` -> `zh-CN`.
 */
export function localeFromPath(pathname: string): string {
  const segment = pathname.split('/')[1] ?? ''
  return /^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(segment) ? segment : 'unknown'
}
