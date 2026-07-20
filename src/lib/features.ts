/**
 * Build-time feature flags derived from NEXT_PUBLIC_* environment variables.
 * All values are baked into the static bundle at build time.
 */

import { resolveOptionalUrl } from '@/lib/utils'

/** Split comma-separated env var into trimmed array, filtering empties. */
function parseDomainList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const _apiBaseUrl = resolveOptionalUrl(process.env.NEXT_PUBLIC_API_BASE_URL)
const _forumUrl = resolveOptionalUrl(process.env.NEXT_PUBLIC_FORUM_URL)
const _allowedDomains = parseDomainList(process.env.NEXT_PUBLIC_ALLOWED_DOMAINS)
const _allowedEmbedDomains = parseDomainList(process.env.NEXT_PUBLIC_ALLOWED_EMBED_DOMAINS)
const _adReportUrl = resolveOptionalUrl(process.env.NEXT_PUBLIC_AD_REPORT_URL)

export const FEATURES = {
  /** Whether login / cloud sync is available (requires NEXT_PUBLIC_API_BASE_URL).
   *  Set to "disabled" on platforms that require a non-empty value to turn off. */
  auth: !!_apiBaseUrl,

  /** Whether the embedded forum is available (requires NEXT_PUBLIC_FORUM_URL). */
  forum: !!_forumUrl,

  /** Forum base URL (resolved, undefined if disabled/unset). */
  forumUrl: _forumUrl,

  /** Whether Turnstile CAPTCHA is available. */
  turnstile: !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,

  /** Whether anti-mirror (domain check) is enabled. */
  antiMirror: _allowedDomains.length > 0,

  /** Whether anti-embed (frame check) is enabled. */
  antiEmbed: _allowedEmbedDomains.length > 0,

  /** Allowed hostnames for anti-mirror (exact match, no subdomain wildcard). */
  allowedDomains: _allowedDomains,

  /** Allowed embedder hostnames for anti-embed (exact match, no subdomain wildcard). */
  allowedEmbedDomains: _allowedEmbedDomains,

  /** Whether sidebar ads are enabled for this deployment. */
  ads: process.env.NEXT_PUBLIC_ADS_ENABLED === 'true',
  /** Anonymous ad-event endpoint, baked into the static bundle. */
  adReportUrl: _adReportUrl ?? '',
} as const
