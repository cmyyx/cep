/** Shared loading-state minimum display duration (ms).
 *  Prevents skeleton / placeholder flashes when data resolves too quickly. */
export const MIN_LOADING_DISPLAY_MS = 300

/** Default site URL used as fallback when SITE_URL env var is not set. */
export const DEFAULT_SITE_URL = 'https://end.canmoe.com'

/** 运营服务 (ops) 源站。可用 NEXT_PUBLIC_OPS_SERVICE_ORIGIN 覆盖（本地联调后端时使用）。 */
export const OPS_SERVICE_ORIGIN = process.env.NEXT_PUBLIC_OPS_SERVICE_ORIGIN?.trim() || 'https://end-ops.canmoe.com'

/**
 * sessionStorage key holding the persisted app-init state (`useAppInitStore`).
 *
 * Shared by two places that cannot import each other: the zustand store, and the
 * inline `<head>` bootstrap in `app/layout.tsx` that sets `<html data-cep-init-done>`
 * before the body is parsed. The inline script reads zustand/persist's envelope
 * shape (`{ state: { hasCompleted }, version }`).
 */
export const APP_INIT_STORAGE_KEY = 'cep-app-init'
