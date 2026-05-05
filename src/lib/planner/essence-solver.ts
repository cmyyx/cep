import type { Weapon, Dungeon } from '@/types/matrix'

export interface WeaponMatch {
  weapon: Weapon
  isSelected: boolean
}

export interface DungeonPlan {
  dungeon: Dungeon
  lockType: 's2' | 's3'
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

export function solve(
  selectedWeaponIds: Set<string>,
  allWeapons: Weapon[],
  dungeons: Dungeon[],
): PlanResult {
  const dungeonPlans: DungeonPlan[] = []

  for (const dungeon of dungeons) {
    // Eligible: weapons whose s2 AND s3 are BOTH in this dungeon's pools
    const eligible = allWeapons.filter(
      (w) =>
        dungeon.s2Pool.includes(w.elementalDamage) &&
        dungeon.s3Pool.includes(w.specialAbility),
    )

    // --- s2-lock plans: lock on s2, any s3 in pool ---
    const s2Options = [
      ...new Set(eligible.map((w) => w.elementalDamage)),
    ]
    for (const s2Lock of s2Options) {
      const matched: WeaponMatch[] = []
      const s1Counts: Record<string, number> = {}

      for (const w of eligible) {
        if (w.elementalDamage !== s2Lock) continue
        matched.push({ weapon: w, isSelected: selectedWeaponIds.has(w.id) })
        s1Counts[w.primaryStat] = (s1Counts[w.primaryStat] || 0) + 1
      }

      if (matched.length === 0) continue
      dungeonPlans.push(buildPlan(dungeon, 's2', s2Lock, matched, s1Counts))
    }

    // --- s3-lock plans: lock on s3, any s2 in pool ---
    const s3Options = [
      ...new Set(eligible.map((w) => w.specialAbility)),
    ]
    for (const s3Lock of s3Options) {
      const matched: WeaponMatch[] = []
      const s1Counts: Record<string, number> = {}

      for (const w of eligible) {
        if (w.specialAbility !== s3Lock) continue
        matched.push({ weapon: w, isSelected: selectedWeaponIds.has(w.id) })
        s1Counts[w.primaryStat] = (s1Counts[w.primaryStat] || 0) + 1
      }

      if (matched.length === 0) continue
      dungeonPlans.push(buildPlan(dungeon, 's3', s3Lock, matched, s1Counts))
    }
  }

  // Sort: selected count desc, then total count desc
  dungeonPlans.sort((a, b) => b.selectedCount - a.selectedCount || b.totalCount - a.totalCount)

  return { dungeonPlans }
}

function buildPlan(
  dungeon: Dungeon,
  lockType: 's2' | 's3',
  lockValue: string,
  matched: WeaponMatch[],
  s1Counts: Record<string, number>,
): DungeonPlan {
  const s1Candidates = Object.keys(s1Counts)
  const needsS1Choice = s1Candidates.length > 3

  // Count selected weapons per s1
  const selectedS1Counts: Record<string, number> = {}
  for (const m of matched) {
    if (m.isSelected) {
      selectedS1Counts[m.weapon.primaryStat] = (selectedS1Counts[m.weapon.primaryStat] || 0) + 1
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
