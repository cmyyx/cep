import type { Weapon, Dungeon } from '@/types/matrix'

export interface WeaponMatch {
  weapon: Weapon
  isSelected: boolean
}

export interface DungeonPlan {
  dungeon: Dungeon
  lockType: 's2' | 's3' | 'none'
  lockValue: string
  matchedWeapons: WeaponMatch[]
  selectedCount: number
  totalCount: number
  s1Candidates: string[]
  s1CandidateCounts: Record<string, number>
  needsS1Choice: boolean
  selectedS1: string[]
}

export interface PlanResult {
  dungeonPlans: DungeonPlan[]
}

function matchesPool(value: string | null, pool: readonly string[]): boolean {
  return value === null || pool.includes(value)
}

function matchesLock(value: string | null, lock: string): boolean {
  return value === null || value === lock
}

function addS1Count(counts: Record<string, number>, value: string | null): void {
  if (value !== null) counts[value] = (counts[value] || 0) + 1
}

export function solve(
  selectedWeaponIds: Set<string>,
  allWeapons: Weapon[],
  dungeons: Dungeon[],
): PlanResult {
  const dungeonPlans: DungeonPlan[] = []

  for (const dungeon of dungeons) {
    const eligible = allWeapons.filter(
      (weapon) =>
        matchesPool(weapon.primaryStat, dungeon.s1Pool) &&
        matchesPool(weapon.elementalDamage, dungeon.s2Pool) &&
        matchesPool(weapon.specialAbility, dungeon.s3Pool),
    )

    const s2Options = [...new Set(eligible.flatMap((weapon) =>
      weapon.elementalDamage === null ? [] : [weapon.elementalDamage]
    ))]
    for (const s2Lock of s2Options) {
      const matched: WeaponMatch[] = []
      const s1Counts: Record<string, number> = {}

      for (const weapon of eligible) {
        if (!matchesLock(weapon.elementalDamage, s2Lock)) continue
        matched.push({ weapon, isSelected: selectedWeaponIds.has(weapon.id) })
        addS1Count(s1Counts, weapon.primaryStat)
      }

      const hasSelectedAnchor = matched.some(
        ({ weapon, isSelected }) => isSelected && weapon.elementalDamage === s2Lock,
      )
      if (matched.length === 0 || (selectedWeaponIds.size > 0 && !hasSelectedAnchor)) continue
      dungeonPlans.push(buildPlan(dungeon, 's2', s2Lock, matched, s1Counts))
    }

    const s3Options = [...new Set(eligible.flatMap((weapon) =>
      weapon.specialAbility === null ? [] : [weapon.specialAbility]
    ))]
    for (const s3Lock of s3Options) {
      const matched: WeaponMatch[] = []
      const s1Counts: Record<string, number> = {}

      for (const weapon of eligible) {
        if (!matchesLock(weapon.specialAbility, s3Lock)) continue
        matched.push({ weapon, isSelected: selectedWeaponIds.has(weapon.id) })
        addS1Count(s1Counts, weapon.primaryStat)
      }

      const hasSelectedAnchor = matched.some(
        ({ weapon, isSelected }) => isSelected && weapon.specialAbility === s3Lock,
      )
      if (matched.length === 0 || (selectedWeaponIds.size > 0 && !hasSelectedAnchor)) continue
      dungeonPlans.push(buildPlan(dungeon, 's3', s3Lock, matched, s1Counts))
    }

    const unconstrained = eligible
      .filter((weapon) => weapon.elementalDamage === null && weapon.specialAbility === null)
      .map((weapon) => ({ weapon, isSelected: selectedWeaponIds.has(weapon.id) }))
    if (unconstrained.some(({ isSelected }) => isSelected)) {
      const s1Counts: Record<string, number> = {}
      for (const { weapon } of unconstrained) addS1Count(s1Counts, weapon.primaryStat)
      dungeonPlans.push(buildPlan(dungeon, 'none', 'any', unconstrained, s1Counts))
    }
  }

  // Sort: selected count desc, then total count desc
  dungeonPlans.sort((a, b) => b.selectedCount - a.selectedCount || b.totalCount - a.totalCount)

  return { dungeonPlans }
}

function buildPlan(
  dungeon: Dungeon,
  lockType: DungeonPlan['lockType'],
  lockValue: string,
  matched: WeaponMatch[],
  s1Counts: Record<string, number>,
): DungeonPlan {
  const s1Candidates = Object.keys(s1Counts)
  const needsS1Choice = s1Candidates.length > 3

  // Count selected weapons per s1
  const selectedS1Counts: Record<string, number> = {}
  for (const match of matched) {
    if (match.isSelected && match.weapon.primaryStat !== null) {
      const stat = match.weapon.primaryStat
      selectedS1Counts[stat] = (selectedS1Counts[stat] || 0) + 1
    }
  }

  // Sort s1: selected weapons' s1 first (by selected count), then by total count
  const sortedS1 = s1Candidates.sort((a, b) => {
    const aSelected = selectedS1Counts[a] || 0
    const bSelected = selectedS1Counts[b] || 0
    if (aSelected !== bSelected) return bSelected - aSelected
    return (s1Counts[b] || 0) - (s1Counts[a] || 0)
  })
  const selectedS1 = sortedS1.slice(0, 3)

  return {
    dungeon,
    lockType,
    lockValue,
    matchedWeapons: [
      ...matched.filter((m) => m.isSelected),
      ...matched.filter((m) => !m.isSelected),
    ],
    selectedCount: matched.filter((m) => m.isSelected).length,
    totalCount: matched.length,
    s1Candidates,
    s1CandidateCounts: s1Counts,
    needsS1Choice,
    selectedS1,
  }
}
