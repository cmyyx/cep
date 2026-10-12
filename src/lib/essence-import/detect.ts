/**
 * Import-format sniffing for the data importer.
 *
 * Two shapes are supported:
 *  - 'cep-backup'      — this app's own export envelope (`{ version, modules }`).
 *  - 'maamend-essence' — MaaEND's 无暇基质库存 export (a bare, possibly empty array).
 *
 * Detection is structural (never filename based) so the file picker and the
 * global drag & drop overlay behave identically.
 */

export type ImportKind = 'cep-backup' | 'maamend-essence'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Loose shape check for one MaaEND inventory entry.
 *
 * Deliberately loose: a MaaEND file with a broken entry is still reported as
 * `maamend-essence` so the strict parser (and its error message) can explain
 * what is wrong, instead of falling through to "unrecognized file".
 */
function looksLikeMaaEndEntry(value: unknown): boolean {
  if (!isRecord(value)) return false
  return Array.isArray(value.weapon_ids) && Array.isArray(value.essences)
}

/** Detect which importer should handle `json`, or null when neither matches. */
export function detectImportKind(json: unknown): ImportKind | null {
  if (isRecord(json)) {
    const isCepEnvelope =
      typeof json.version === 'number' && json.version >= 1 && isRecord(json.modules)
    return isCepEnvelope ? 'cep-backup' : null
  }
  // An empty array is a valid MaaEND result ("complete scan, nothing found").
  if (Array.isArray(json) && json.every(looksLikeMaaEndEntry)) return 'maamend-essence'
  return null
}
