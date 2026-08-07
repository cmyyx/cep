import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import zhCN from '@/messages/zh-CN.json'
import zhTW from '@/messages/zh-TW.json'
import type { WikiLocale } from '@/types/wiki'

export const NOT_FOUND_LOCALES = ['zh-CN', 'zh-TW', 'ja', 'en'] as const satisfies readonly WikiLocale[]

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
 */
export const NOT_FOUND_PANELS: readonly NotFoundPanel[] = NOT_FOUND_LOCALES.map((locale) => ({
  locale,
  title: localeMessages[locale].notFound.title,
  homeLink: localeMessages[locale].notFound.homeLink,
  metaMessages: pickMetaMessages(localeMessages[locale]),
}))

const DEFAULT_LOCALE: WikiLocale = 'zh-CN'

/**
 * Set the locale marker before the static 404 body is parsed. A missing or
 * unrecognised path segment falls back to zh-CN; the client page separately
 * redirects non-locale paths to the preferred locale.
 */
export function buildNotFoundLocaleScript(): string {
  return (
    '(function(){' +
    'try{' +
    `var L=${JSON.stringify(NOT_FOUND_LOCALES)},` +
    "s=location.pathname.split('/')[1]||''," +
    'l=L.find(function(x){return x.toLowerCase()===s.toLowerCase()})||' + JSON.stringify(DEFAULT_LOCALE) + ';' +
    "document.documentElement.setAttribute('data-notfound-lang',l);" +
    'document.documentElement.lang=l' +
    '}catch(e){}}())'
  )
}
