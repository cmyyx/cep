// Shared lossless JSON utilities (int64-safe).
// All int64 text IDs are preserved as strings to avoid JavaScript Number
// truncation (> 2^53). Used by sync scripts that read upstream TableCfg JSON.
// ================================================================================

import { readFileSync } from 'node:fs'
import { parse as parseLossless } from 'lossless-json'

/**
 * Recursively convert lossless-json number objects to plain strings.
 * Safe to call on already-plain values (no-op for primitives).
 */
export function convertLosslessToPlain(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'object' && 'isLosslessNumber' in value) return String(value)
  if (Array.isArray(value)) return value.map(convertLosslessToPlain)
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = convertLosslessToPlain(v)
    }
    return result
  }
  return value
}

/**
 * Parse a JSON file with int64-safe handling via lossless-json.
 * All large integers are preserved as strings, everything else as plain JS types.
 */
export function parseJsonSafe(filePath: string): unknown {
  const raw = readFileSync(filePath, 'utf-8')
  return convertLosslessToPlain(parseLossless(raw))
}
