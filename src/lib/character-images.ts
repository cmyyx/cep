import characterNames from '@/generated/i18n/characters/zh-CN.json'
import previewCharacterAvatars from '@/generated/data/wiki/preview-character-avatars.json'

const PREVIEW_AVATAR_BY_NAME = previewCharacterAvatars as Record<string, string>

const ADMINISTRATOR_ID = 'chr_9000_endmin'
const DEPRECATED_ADMIN_IDS = new Set(['chr_0002_endminm', 'chr_0003_endminf'])

const CHARACTER_ID_BY_NAME = new Map(
  Object.entries(characterNames)
    .filter(
      ([id, name]) =>
        id.startsWith('chr_') &&
        !DEPRECATED_ADMIN_IDS.has(id) &&
        id !== ADMINISTRATOR_ID &&
        name !== id
    )
    .map(([id, name]) => [name, id])
)

function isAdministratorName(name: string): boolean {
  return /^管理员(?:\s*[（(][男女][)）])?$/.test(name.trim())
}

export function getCharacterAvatarPath(name: string): string | null {
  const normalized = name.trim()
  const assetId = isAdministratorName(normalized)
    ? ADMINISTRATOR_ID
    : CHARACTER_ID_BY_NAME.get(normalized) ?? PREVIEW_AVATAR_BY_NAME[normalized] ?? null

  return assetId ? `/images/characters/${assetId}.avif` : null
}
