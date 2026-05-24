/**
 * Build-time feature flags derived from NEXT_PUBLIC_* environment variables.
 * All values are baked into the static bundle at build time.
 */

/** Split comma-separated env var into trimmed array, filtering empties. */
function parseDomainList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const _allowedDomains = parseDomainList(process.env.NEXT_PUBLIC_ALLOWED_DOMAINS)
const _allowedEmbedDomains = parseDomainList(process.env.NEXT_PUBLIC_ALLOWED_EMBED_DOMAINS)

export const FEATURES = {
  /** Whether login / cloud sync is available (requires NEXT_PUBLIC_API_BASE_URL). */
  auth: !!process.env.NEXT_PUBLIC_API_BASE_URL,

  /** Whether Turnstile CAPTCHA is available. */
  turnstile: !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,

  /** Whether anti-mirror (domain check) is enabled. */
  antiMirror: !!process.env.NEXT_PUBLIC_ALLOWED_DOMAINS,

  /** Whether anti-embed (frame check) is enabled. */
  antiEmbed: !!process.env.NEXT_PUBLIC_ALLOWED_EMBED_DOMAINS,

  /** Allowed hostnames for anti-mirror (exact match, no subdomain wildcard). */
  allowedDomains: _allowedDomains,

  /** Allowed embedder hostnames for anti-embed (exact match, no subdomain wildcard). */
  allowedEmbedDomains: _allowedEmbedDomains,
} as const
