import characterNames from '@/generated/i18n/characters/zh-CN.json'
import previewCharacterAvatars from '@/generated/data/wiki/preview-character-avatars.json'
import { createCharacterAvatarResolver } from './character-avatar-resolve'

const resolver = createCharacterAvatarResolver({
  characterNames: characterNames as Record<string, string>,
  previewAvatars: previewCharacterAvatars as Record<string, string>,
})

/**
 * Resolves a localized character name to its avatar file.
 *
 * Preview characters (announced on the Skland wiki but not yet in the game data)
 * resolve through `preview-character-avatars.json`, which the sync pipeline
 * regenerates on every scrape. Unmapped names return null — callers decide
 * whether that is a fallback (weapon cards) or a hard error (banner schedule).
 */
export function getCharacterAvatarPath(name: string): string | null {
  const assetId = resolver.resolve(name)
  return assetId ? `/images/characters/${assetId}.avif` : null
}
