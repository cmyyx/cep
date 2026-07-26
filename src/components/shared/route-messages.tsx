'use client'

import { useMemo } from 'react'
import { NextIntlClientProvider, useLocale, useMessages, useTimeZone } from 'next-intl'

export interface RouteMessagesProps {
  /** Route-scoped message namespaces (shell subsets and/or planner catalogs). */
  messages: Record<string, unknown>
  children: React.ReactNode
}

/**
 * Nested NextIntlClientProvider that merges route-scoped messages over the core shell bag.
 * Mount in a route layout so only that route's payload embeds the extra namespaces —
 * the root provider stays minimal for every other page (see src/i18n/route-shell-messages.json).
 * Shallow merge: a full namespace here replaces the core's key-level subset (superset).
 */
export function RouteMessages({ messages, children }: RouteMessagesProps) {
  const locale = useLocale()
  const timeZone = useTimeZone()
  const coreMessages = useMessages()
  const merged = useMemo(
    () => ({ ...coreMessages, ...messages }),
    [coreMessages, messages],
  )

  return (
    <NextIntlClientProvider messages={merged} locale={locale} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  )
}

export default RouteMessages
