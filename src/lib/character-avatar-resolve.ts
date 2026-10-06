/**
 * Character name → avatar asset id resolution rules.
 *
 * Deliberately dependency-free so both the app (`src/lib/character-images.ts`)
 * and the data sync scripts (`scripts/lib/validate-data.ts`) resolve names with
 * the exact same rules. When the two drift, a sync run can report "all good"
 * while the build fails on the same missing mapping.
 */

/** Base id of the player character (administrator); never resolved directly. */
export const ADMINISTRATOR_ID = 'chr_9000_endmin'

/** Pre-1.4 administrator entries kept in the i18n table for legacy saves. */
export const DEPRECATED_ADMIN_IDS: readonly string[] = ['chr_0002_endminm', 'chr_0003_endminf']

export interface CharacterAvatarLookup {
  /** i18n id → localized name (`src/generated/i18n/characters/zh-CN.json`). */
  characterNames: Readonly<Record<string, string>>
  /** Skland preview name → `preview-<itemId>` asset id. */
  previewAvatars: Readonly<Record<string, string>>
}

export interface CharacterAvatarResolver {
  /** Returns the asset id (without extension) or null when unmapped. */
  resolve(name: string): string | null
}

/** Released characters only: no deprecated entries, no bare administrator, no untranslated ids. */
export function buildCharacterIdByName(
  characterNames: Readonly<Record<string, string>>,
): Map<string, string> {
  return new Map(
    Object.entries(characterNames)
      .filter(
        ([id, name]) =>
          id.startsWith('chr_') &&
          !DEPRECATED_ADMIN_IDS.includes(id) &&
          id !== ADMINISTRATOR_ID &&
          name !== id,
      )
      .map(([id, name]) => [name, id]),
  )
}

/** Administrator variants share the base avatar id with a `-male` / `-female` suffix. */
export function resolveAdministratorAssetId(name: string): string | null {
  if (/^管理员\s*[（(]男[)）]$/.test(name)) {
    return `${ADMINISTRATOR_ID}-male`
  }
  if (/^管理员(?:\s*[（(]女[)）])?$/.test(name)) {
    return `${ADMINISTRATOR_ID}-female`
  }
  return null
}

export function createCharacterAvatarResolver(
  lookup: CharacterAvatarLookup,
): CharacterAvatarResolver {
  const idByName = buildCharacterIdByName(lookup.characterNames)
  return {
    resolve(name: string): string | null {
      const normalized = name.trim()
      return (
        resolveAdministratorAssetId(normalized) ??
        idByName.get(normalized) ??
        lookup.previewAvatars[normalized] ??
        null
      )
    },
  }
}
