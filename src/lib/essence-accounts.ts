/**
 * Game-account profile helpers for the essence planner (protocol v3).
 *
 * A website user may maintain multiple game accounts; each game account
 * owns its own marks (weapon ownership / essence status / weapon notes).
 * Custom weapons and UI preferences stay global.
 *
 * Sync limits are enforced as SUMS across accounts (the game accounts share
 * the website account's quota) — see cep-backend validateSyncPayload.
 */

import type { EssenceAccount } from '@/types/essence-settings'
import { resolveWeaponIdKeys } from '@/lib/resolve-weapon-id'
import { isValidWeaponId } from '@/lib/persist-sanitizer'

/** Max game-account profiles per website account (must match backend). */
export const MAX_ACCOUNTS = 10
/** Max account remark length (must match backend). */
export const MAX_ACCOUNT_NAME_LENGTH = 50
/** Max account id length (must match backend). */
export const MAX_ACCOUNT_ID_LENGTH = 64

/** Generate a stable account id (crypto.randomUUID with a deterministic fallback). */
export function createAccountId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `acc_${crypto.randomUUID()}`
  }
  return `acc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Filter a marks record to valid weapon ids with values of the expected type. */
function sanitizeMarks<T>(value: unknown, isValueValid: (v: unknown) => v is T): Record<string, T> {
  if (!isRecord(value)) return {}
  const resolved = resolveWeaponIdKeys(value)
  const out: Record<string, T> = {}
  for (const [key, val] of Object.entries(resolved)) {
    if (!isValidWeaponId(key)) continue
    if (isValueValid(val)) out[key] = val
  }
  return out
}

const isBoolean = (v: unknown): v is boolean => v === true || v === false
const isString = (v: unknown): v is string => typeof v === 'string'

/** Trim to the account name length limit (used by the rename UI). */
export function clampAccountName(name: string): string {
  return name.slice(0, MAX_ACCOUNT_NAME_LENGTH)
}

/**
 * Sanitize untrusted account entries (localStorage or cloud payload) into
 * well-formed accounts: resolves preview:* ids, drops unknown weapon ids,
 * normalizes names/ids, and caps the list at MAX_ACCOUNTS.
 */
export function sanitizeCloudAccounts(value: unknown): EssenceAccount[] {
  if (!Array.isArray(value)) return []
  const accounts: EssenceAccount[] = []
  for (const raw of value) {
    if (accounts.length >= MAX_ACCOUNTS) break
    if (!isRecord(raw)) continue
    const id = typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= MAX_ACCOUNT_ID_LENGTH
      ? raw.id
      : createAccountId()
    const name = typeof raw.name === 'string' ? raw.name.slice(0, MAX_ACCOUNT_NAME_LENGTH) : ''
    accounts.push({
      id,
      name,
      weaponOwnership: sanitizeMarks(raw.weaponOwnership, isBoolean),
      essenceStatus: sanitizeMarks(raw.essenceStatus, isBoolean),
      weaponNotes: sanitizeMarks(raw.weaponNotes, isString),
    })
  }
  return accounts
}

/** Sum of mark entries across all accounts. */
export function accountEntryCounts(accounts: readonly EssenceAccount[]): {
  ownership: number
  essence: number
  notes: number
} {
  let ownership = 0
  let essence = 0
  let notes = 0
  for (const account of accounts) {
    ownership += Object.keys(account.weaponOwnership).length
    essence += Object.keys(account.essenceStatus).length
    notes += Object.keys(account.weaponNotes).length
  }
  return { ownership, essence, notes }
}

/** Default name for a new account, e.g. "账号 3" / "Account 3". */
export function defaultAccountName(index: number): string {
  return `Account ${index}`
}
