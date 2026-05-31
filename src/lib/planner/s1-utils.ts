/**
 * Compute the effective S1 primary-stat selection for a dungeon plan,
 * taking into account which S1 candidates are actually visible (i.e.
 * have at least one non-hidden weapon).
 *
 * @param stored - User's manual S1 override from `dungeonS1Selections`, or `undefined` if none.
 * @param solverSelectedS1 - Solver's auto-selected S1 stats (`plan.selectedS1`).
 * @param visibleCandidates - S1 stats that have ≥ 1 visible weapon after hide filters.
 * @returns The effective S1 stats to use for this plan card.
 */
export function computeEffectiveS1(
  stored: string[] | undefined,
  solverSelectedS1: string[],
  visibleCandidates: string[],
): string[] {
  // <= 3 visible candidates → no choice needed, use all visible
  if (visibleCandidates.length <= 3) return visibleCandidates

  // No user override → use solver's auto-selection filtered to visible
  if (!stored) {
    const filtered = solverSelectedS1.filter((s) => visibleCandidates.includes(s))
    return filtered.length > 0 ? filtered : visibleCandidates
  }

  // User override exists → filter to visible candidates
  const filtered = stored.filter((s) => visibleCandidates.includes(s))
  if (filtered.length > 0) return filtered

  // Override fully invalid → fall back to solver auto-selection
  const fallback = solverSelectedS1.filter((s) => visibleCandidates.includes(s))
  return fallback.length > 0 ? fallback : visibleCandidates
}
