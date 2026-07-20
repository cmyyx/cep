export type AdEventType =
  | 'attempted'
  | 'sdk_loaded'
  | 'loaded'
  | 'error'
  | 'sdk_load_error'
  | 'timeout'

export interface AdAttempt {
  attemptId: string
  path: string
  locale: string
  siteHost: string
  startedAt: string
}

export interface AdEventPayload {
  schemaVersion: 1
  eventId: string
  attemptId: string
  event: AdEventType
  errorCode?: string
  provider: 'adwork'
  placementId: 'sidebar-1110'
  siteHost: string
  path: string
  locale: string
  buildVersion: string
  clientTime: string
}

type Listener = () => void

let currentAttempt: AdAttempt | null = null
const listeners = new Set<Listener>()

export function getAdAttempt(): AdAttempt | null {
  return currentAttempt
}

export function subscribeAdAttempt(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function startAdAttempt(): AdAttempt {
  if (currentAttempt) return currentAttempt
  currentAttempt = {
    attemptId: crypto.randomUUID(),
    path: window.location.pathname,
    locale: document.documentElement.lang || 'unknown',
    siteHost: window.location.hostname,
    startedAt: new Date().toISOString(),
  }
  for (const listener of listeners) listener()
  return currentAttempt
}

export function createAdEventPayload(
  attempt: AdAttempt,
  event: AdEventType,
  buildVersion: string,
  errorCode?: string,
  now = new Date(),
  eventId = crypto.randomUUID(),
): AdEventPayload {
  return {
    schemaVersion: 1,
    eventId,
    attemptId: attempt.attemptId,
    event,
    ...(event === 'error' ? { errorCode: errorCode?.trim() || 'Unknown' } : {}),
    provider: 'adwork',
    placementId: 'sidebar-1110',
    siteHost: attempt.siteHost,
    path: attempt.path,
    locale: attempt.locale,
    buildVersion,
    clientTime: now.toISOString(),
  }
}


export function reportAdEvent(reportUrl: string, payload: AdEventPayload): void {
  if (!reportUrl) return
  const body = JSON.stringify(payload)
  try {
    void fetch(reportUrl, {
      method: 'POST',
      mode: 'no-cors',
      credentials: 'omit',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
    }).catch(() => {})
  } catch {
    try {
      navigator.sendBeacon(reportUrl, body)
    } catch {
      // Telemetry must never affect ad rendering.
    }
  }
}
