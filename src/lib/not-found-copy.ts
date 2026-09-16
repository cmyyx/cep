import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import zhCN from '@/messages/zh-CN.json'
import zhTW from '@/messages/zh-TW.json'
import { NOT_FOUND_LOCALES } from '@/lib/not-found-locale'
import type { WikiLocale } from '@/types/wiki'

export type NotFoundMetaMessages = {
  environment: {
    browser: string
    engine: string
  }
  version: {
    version: string
    commitCount: string
    commitTime: string
    buildTime: string
  }
}

export type NotFoundPanel = {
  locale: WikiLocale
  title: string
  homeLink: string
  metaMessages: NotFoundMetaMessages
}

type LocaleMessages = NotFoundMetaMessages & {
  notFound: {
    title: string
    homeLink: string
  }
}

const localeMessages = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  en,
} satisfies Record<WikiLocale, LocaleMessages>

function pickMetaMessages(messages: LocaleMessages): NotFoundMetaMessages {
  return {
    environment: messages.environment,
    version: {
      version: messages.version.version,
      commitCount: messages.version.commitCount,
      commitTime: messages.version.commitTime,
      buildTime: messages.version.buildTime,
    },
  }
}

/**
 * Build-time 404 copy extracted from the locale JSON files.
 *
 * The root 404 is a single static document, so all locale labels are emitted
 * into its HTML. Keeping the source in messages/*.json avoids a second set of
 * hand-maintained translations while still making the text available without
 * a runtime message request or a full NextIntl message bundle.
 *
 * This module imports all four catalogs, so it must stay reachable only from
 * the 404 route. Locale plumbing shared with `app/layout.tsx` lives in
 * `not-found-locale.ts` instead.
 */
export const NOT_FOUND_PANELS: readonly NotFoundPanel[] = NOT_FOUND_LOCALES.map((locale) => ({
  locale,
  title: localeMessages[locale].notFound.title,
  homeLink: localeMessages[locale].notFound.homeLink,
  metaMessages: pickMetaMessages(localeMessages[locale]),
}))
