/**
 * Bridging caught errors to i18n keys.
 *
 * `getErrorI18nKey()` echoes unknown codes back unchanged, so feeding its result
 * straight into `t()` renders a bare backend code (`invalid_credentials`) or a
 * bare local marker (`loginFailed`) to the user. Callers must therefore separate
 * "API code → mapped key" from "local literal key", which is what this helper does.
 */

import { ApiError, getErrorI18nKey } from '@/lib/api'

/**
 * Resolve a caught error into a namespaced i18n key.
 *
 * @param err          Caught value; only `ApiError.code` / `Error.message` are inspected.
 * @param fallbackKey  Namespaced key used when the code has no mapping.
 */
export function resolveErrorI18nKey(err: unknown, fallbackKey: string): string {
  const code = err instanceof ApiError
    ? err.code
    : err instanceof Error
      ? err.message
      : ''
  if (!code) return fallbackKey
  const key = getErrorI18nKey(code)
  // Unmapped codes come back untouched — those are not usable i18n keys.
  return key === code ? fallbackKey : key
}
