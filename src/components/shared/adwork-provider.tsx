'use client'

import { useSyncExternalStore } from 'react'
import Script from 'next/script'
import {
  ADWORK_SDK_URL,
  adworkSlotFromElement,
  localeFromPath,
  reportPartnerAdEvent,
} from '@/lib/adwork'
import { useShouldHideAds } from '@/hooks/use-should-hide-ads'
import { useAdworkStore } from '@/stores/useAdworkStore'

/**
 * Register the SDK's media callbacks at module scope.
 *
 * This is the only reliable ordering: the SDK looks `window.adwork` up when it
 * runs, and a client chunk is evaluated before React hydrates and before an
 * `afterInteractive` script is injected. Registering in an effect and only then
 * rendering the script tag would work too, but it costs a cascading render and
 * a window in which the SDK can execute with no callback installed.
 *
 * The callbacks read everything from external state (the store, the current
 * URL), so they never close over a render that may have been discarded.
 */
if (typeof window !== 'undefined') {
  window.adwork = {
    onLoaded(ad) {
      const slot = adworkSlotFromElement(ad?.element)
      if (slot === null) return
      if (useAdworkStore.getState().dismissed[slot]) return
      useAdworkStore.getState().setPhase(slot, 'loaded')
      // One report per fill: the SDK asks for a new creative on every client
      // side navigation, so a long session produces several impressions and
      // that is exactly what the beacon means.
      const path = window.location.pathname
      reportPartnerAdEvent('impression', slot, path, localeFromPath(path))
    },
    onError() {
      // The error carries the placement id, not the element. Only one slot is
      // mounted at a time, so the active slot is unambiguous.
      const slot = useAdworkStore.getState().activeSlot
      if (slot === null) return
      useAdworkStore.getState().setPhase(slot, 'failed')
    },
  }
}

/**
 * Loads the Adwork SDK, once.
 *
 * The SDK refuses to run when it finds a second makemoney.js tag, so this
 * component is mounted once in the locale layout and never per route. It only
 * mounts the script after the client knows whether the visitor is ad-free: a
 * paid member must not download the ad network at all, and a hidden container
 * would leave the SDK's route rescan with nothing to observe.
 */
export function AdworkProvider() {
  const hideAds = useShouldHideAds()
  // Server snapshot is false: the script is client only, and rendering it on
  // the server would make the premium decision arrive after the tag exists.
  const clientReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  if (!clientReady || hideAds) return null

  return (
    <Script
      id="adwork-sdk"
      src={ADWORK_SDK_URL}
      strategy="afterInteractive"
      charSet="UTF-8"
      onError={() => {
        const slot = useAdworkStore.getState().activeSlot
        if (slot !== null) useAdworkStore.getState().setPhase(slot, 'failed')
      }}
    />
  )
}

export default AdworkProvider
