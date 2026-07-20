import characterNames from '@/generated/i18n/characters/zh-CN.json'

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

const PREVIEW_ASSET_ID_BY_NAME: Record<string, string> = { 梨诺: 'skland-1683' }

function isAdministratorName(name: string): boolean {
  return /^管理员(?:\s*[（(][男女][)）])?$/.test(name.trim())
}

export function getCharacterAvatarPath(name: string): string | null {
  const normalized = name.trim()
  const assetId = isAdministratorName(normalized)
    ? ADMINISTRATOR_ID
    : CHARACTER_ID_BY_NAME.get(normalized) ?? PREVIEW_ASSET_ID_BY_NAME[normalized]

  return assetId ? `/images/characters/${assetId}.avif` : null
}
