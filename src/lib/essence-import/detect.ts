/**
 * Import-format sniffing for the data importer.
 *
 * Two shapes are supported:
 *  - 'cep-backup'      — this app's own export envelope (`{ version, modules }`).
 *  - 'maamend-essence' — MaaEND's 基质库存 (`{ format: 'maaend.essence_inventory', … }`).
 *                        The retired bare array is routed here too, so the parser
 *                        can say "re-export with a newer MaaEND" instead of the
 *                        file falling through to "unrecognized file".
 *
 * Detection is structural (never filename based) so the file picker and the
 * global drag & drop overlay behave identically.
 */

import { MAAEND_INVENTORY_FORMAT } from './protocol'

export type ImportKind = 'cep-backup' | 'maamend-essence'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Loose shape check for one retired-format (array) MaaEND entry.
 *
 * Deliberately loose: any array shaped like the old export is routed to the
 * parser, which rejects the whole format with a dedicated message.
 */
function looksLikeMaaEndEntry(value: unknown): boolean {
  if (!isRecord(value)) return false
  return Array.isArray(value.weapon_ids) && Array.isArray(value.essences)
}

/**
 * Detect which importer should handle `json`, or null when neither matches.
 *
 * Protocol-v1 MaaEND files are recognized by their `format` marker alone — the
 * `version` is deliberately NOT checked here: a newer protocol must still reach
 * the MaaEND parser so the dialog can say "this file is newer than we support"
 * instead of "unrecognized file".
 */
export function detectImportKind(json: unknown): ImportKind | null {
  if (isRecord(json)) {
    if (json.format === MAAEND_INVENTORY_FORMAT) return 'maamend-essence'
    const isCepEnvelope =
      typeof json.version === 'number' && json.version >= 1 && isRecord(json.modules)
    return isCepEnvelope ? 'cep-backup' : null
  }
  // Retired array format (and the empty array it could contain): recognized only
  // so the dialog can tell the user to re-export, never so it gets imported.
  if (Array.isArray(json) && json.every(looksLikeMaaEndEntry)) return 'maamend-essence'
  return null
}
