/**
 * Guards for the OAuth deny/cancel hand-back.
 *
 * `redirect_uri` arrives from the query string. The authorize call is validated
 * server-side against the registered client, but the cancel path has no server
 * round-trip — sending the browser to whatever the query string says is a textbook
 * open redirect. The build-time allowlist below reuses the constraints the app
 * already has: the embedded forum (the only registered OAuth consumer) plus the
 * site's own domains.
 */

import { FEATURES } from '@/lib/features'

/** Loopback hosts are allowed on any port so local OAuth clients stay testable. */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/**
 * Hosts the cancel flow may redirect to.
 *
 * @param currentHost `window.location.host`, so a self-hosted deployment without
 *                    NEXT_PUBLIC_ALLOWED_DOMAINS can still bounce back to itself.
 */
export function getAllowedRedirectHosts(currentHost?: string): string[] {
  const hosts = new Set<string>()
  if (FEATURES.forumUrl) {
    try {
      hosts.add(new URL(FEATURES.forumUrl).host.toLowerCase())
    } catch {
      /* malformed env value — ignore */
    }
  }
  for (const domain of FEATURES.allowedDomains) hosts.add(domain.toLowerCase())
  if (currentHost) hosts.add(currentHost.toLowerCase())
  return [...hosts]
}

/**
 * Build the `access_denied` callback URL, or null when `redirectUri` is not a
 * vetted absolute https target (callers must then show an error instead).
 */
export function buildOAuthDenyRedirect(
  redirectUri: string,
  state: string,
  allowedHosts: readonly string[],
): string | null {
  if (!redirectUri) return null

  let url: URL
  try {
    url = new URL(redirectUri)
  } catch {
    // Relative or malformed — reject rather than resolving against our own origin.
    return null
  }

  const hostname = url.hostname.toLowerCase()
  const isLoopback = LOOPBACK_HOSTNAMES.has(hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) return null

  const host = url.host.toLowerCase()
  if (!isLoopback && !allowedHosts.some((allowed) => allowed.toLowerCase() === host)) return null

  // searchParams merges into whatever query redirect_uri already carries,
  // instead of appending a second "?".
  url.searchParams.set('error', 'access_denied')
  url.searchParams.set('error_description', 'The user denied the authorization request')
  if (state) url.searchParams.set('state', state)

  return url.toString()
}
