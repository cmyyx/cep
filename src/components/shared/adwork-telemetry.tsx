'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Script from 'next/script'
import { FEATURES } from '@/lib/features'
import { versionData } from '@/generated/version-data'
import {
  completeAdAttempt,
  createAdEventPayload,
  getAdAttempt,
  reportAdEvent,
  subscribeAdAttempt,
  type AdEventType,
} from '@/lib/ad-telemetry'

type AdworkAd = { element?: HTMLElement }
type AdworkError = { code?: string; message?: string }

declare global {
  interface Window {
    adwork?: {
      onLoaded(ad: AdworkAd): void
      onError(error: AdworkError): void
    }
  }
}

export function AdworkTelemetry() {
  const attempt = useSyncExternalStore(subscribeAdAttempt, getAdAttempt, () => null)
  const [callbacksReady, setCallbacksReady] = useState(false)
  const terminalRef = useRef(false)
  const reportedRef = useRef(new Set<AdEventType>())

  useEffect(() => {
    if (!attempt) return

    const report = (event: AdEventType, errorCode?: string) => {
      if (reportedRef.current.has(event)) return
      reportedRef.current.add(event)
      reportAdEvent(
        FEATURES.adReportUrl,
        createAdEventPayload(attempt, event, versionData.version, errorCode),
      )
    }
    report('attempted')

    window.adwork = {
      onLoaded(ad) {
        if (terminalRef.current) return
        terminalRef.current = true
        completeAdAttempt('loaded')
        report('loaded')
        window.dispatchEvent(new CustomEvent('cep:adwork-loaded', { detail: ad }))
      },
      onError(error) {
        if (terminalRef.current) return
        terminalRef.current = true
        completeAdAttempt('error')
        report('error', error?.code)
        window.dispatchEvent(new CustomEvent('cep:adwork-error', { detail: error }))
      },
    }
    const readyTimer = window.setTimeout(() => setCallbacksReady(true), 0)

    const timeout = window.setTimeout(() => {
      if (terminalRef.current) return
      terminalRef.current = true
      completeAdAttempt('error')
      report('timeout')
      window.dispatchEvent(
        new CustomEvent('cep:adwork-error', { detail: { code: 'Timeout' } }),
      )
    }, 15_000)

    return () => {
      window.clearTimeout(readyTimer)
      window.clearTimeout(timeout)
    }
  }, [attempt])

  if (!FEATURES.ads || !attempt || !callbacksReady) return null

  return (
    <Script
      id="adwork-sdk"
      src="https://cdn.adwork.net/js/makemoney.js"
      strategy="afterInteractive"
      charSet="UTF-8"
      onLoad={() => {
        if (reportedRef.current.has('sdk_loaded')) return
        reportedRef.current.add('sdk_loaded')
        reportAdEvent(
          FEATURES.adReportUrl,
          createAdEventPayload(attempt, 'sdk_loaded', versionData.version),
        )
      }}
      onError={() => {
        if (terminalRef.current) return
        terminalRef.current = true
        completeAdAttempt('error')
        if (!reportedRef.current.has('sdk_load_error')) {
          reportedRef.current.add('sdk_load_error')
          reportAdEvent(
            FEATURES.adReportUrl,
            createAdEventPayload(attempt, 'sdk_load_error', versionData.version),
          )
        }
        window.dispatchEvent(
          new CustomEvent('cep:adwork-error', { detail: { code: 'SDKLoadError' } }),
        )
      }}
    />
  )
}

export default AdworkTelemetry
