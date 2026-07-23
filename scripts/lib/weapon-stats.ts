export interface WeaponSkillPatchBundle {
  blackboard?: { key: string; value: number }[]
  tagId?: string
  skillId: string
  skillName: { id: string; text: string }
}

export interface WeaponSkillPatchEntry {
  SkillPatchDataBundle: WeaponSkillPatchBundle[]
}

export interface WeaponStats {
  primaryStat: string | null
  elementalDamage: string | null
  specialAbility: string | null
}

export interface WeaponStatsResolution extends WeaponStats {
  unresolvedSkillIds: string[]
}

export const WEAPON_BLACKBOARD_TO_GEM_SUFFIX: Record<string, string> = {
  str: 'str',
  agi: 'agi',
  wisd: 'wisd',
  will: 'will',
  mainattr: 'main',
  atk: 'atk',
  hp: 'hp',
  phydam: 'phydam',
  firedam: 'firedam',
  electrondam: 'pulsedam',
  pulsedam: 'pulsedam',
  icedam: 'icedam',
  crystdam: 'icedam',
  naturaldam: 'naturaldam',
  crirate: 'crirate',
  usp: 'usp',
  usgs: 'usp',
  heal: 'heal',
  physpell: 'physpell',
  spelldam: 'magicdam',
}

export function extractWeaponStatBaseName(skillName: string): string {
  return skillName
    .replace(/[·・]\s*[^·・:]+$/, '')
    .replace(/:\s*[^:·・]+$/, '')
    .replace(/\s*\[[LMS]\]\s*$/, '')
    .trim()
}

function resolveAttributeStat(
  entry: WeaponSkillPatchEntry | undefined,
): string | null {
  const blackboardKey = entry?.SkillPatchDataBundle?.[0]?.blackboard?.[0]?.key
  if (!blackboardKey) return null

  const suffix = WEAPON_BLACKBOARD_TO_GEM_SUFFIX[blackboardKey]
  return suffix ? `gat_passive_attr_${suffix}` : null
}

function resolveSpecialAbility(
  entry: WeaponSkillPatchEntry | undefined,
  tagToGem: Record<string, string>,
  cnTextTable: Record<string, string>,
  cnToGem: Record<string, string>,
): string | null {
  const bundle = entry?.SkillPatchDataBundle?.[0]
  if (!bundle) return null

  const taggedGem = bundle.tagId ? tagToGem[bundle.tagId] : undefined
  if (taggedGem) return taggedGem

  const localizedName = cnTextTable[bundle.skillName?.id] || bundle.skillName?.text
  if (!localizedName) return null

  return cnToGem[extractWeaponStatBaseName(localizedName)] ?? null
}

/**
 * Resolve the three project weapon slots from upstream skill IDs.
 *
 * Slot identity comes from the upstream skill ID family, not from a skill's
 * blackboard. Weapon passive skills can contain keys such as `atk_up`; treating
 * those keys as an additional attribute makes three-star weapons lose their
 * real skill slot.
 */
export function resolveWeaponStats(
  skillIds: string[],
  skillPatch: Record<string, WeaponSkillPatchEntry>,
  tagToGem: Record<string, string>,
  cnTextTable: Record<string, string>,
  cnToGem: Record<string, string>,
): WeaponStatsResolution {
  let primaryStat: string | null = null
  let elementalDamage: string | null = null
  let specialAbility: string | null = null
  const unresolvedSkillIds: string[] = []

  for (const skillId of skillIds) {
    const entry = skillPatch[skillId]

    if (skillId.startsWith('wpn_sp_attr_')) {
      const resolved = resolveAttributeStat(entry)
      if (resolved && elementalDamage === null) elementalDamage = resolved
      else unresolvedSkillIds.push(skillId)
      continue
    }

    if (skillId.startsWith('wpn_attr_')) {
      const resolved = resolveAttributeStat(entry)
      if (resolved && primaryStat === null) primaryStat = resolved
      else unresolvedSkillIds.push(skillId)
      continue
    }

    if (skillId.startsWith('sk_wpn_')) {
      const resolved = resolveSpecialAbility(entry, tagToGem, cnTextTable, cnToGem)
      if (resolved && specialAbility === null) specialAbility = resolved
      else unresolvedSkillIds.push(skillId)
      continue
    }

    unresolvedSkillIds.push(skillId)
  }

  return { primaryStat, elementalDamage, specialAbility, unresolvedSkillIds }
}
