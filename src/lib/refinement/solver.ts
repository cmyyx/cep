import type {
  Equip,
  ParsedStat,
  SlotKey,
  SlotRecommendation,
  RefinementCandidate,
} from '@/types/refinement'
import { equips } from '@/data/equips'

const SLOT_KEYS: SlotKey[] = ['sub1', 'sub2', 'special']

/**
 * Find the best-matching attribute in a candidate equip for a given target attribute.
 * Scans all three slots (sub1/sub2/special) and returns the one with the same stat name
 * and unit, and whose value is >= target value.
 */
function getCandidateBestMatch(
  candidate: Equip,
  targetAttr: ParsedStat,
): { matchAttr: ParsedStat; matchSlotKey: SlotKey } | null {
  let best: { matchAttr: ParsedStat; matchSlotKey: SlotKey } | null = null

  for (const slotKey of SLOT_KEYS) {
    const slotAttr = candidate[slotKey]
    if (!slotAttr) continue
    if (slotAttr.stat !== targetAttr.stat) continue
    if (slotAttr.unit !== targetAttr.unit) continue
    if (!Number.isFinite(slotAttr.value)) continue
    if (slotAttr.value < targetAttr.value) continue

    if (
      !best ||
      slotAttr.value > best.matchAttr.value
    ) {
      best = { matchAttr: slotAttr, matchSlotKey: slotKey }
    }
  }

  return best
}

/**
 * Collect refinement candidates for a given slot of the selected equipment.
 *
 * Logic:
 * 1. For each equip of the same type (not self), check if any of its 3 slots
 *    has the same stat name + unit + value >= target.
 * 2. Separate into higher-value and same-value groups.
 * 3. If higher-value exists: return them sorted descending by value.
 * 4. If only same-value: return self first, then same-value candidates.
 */
function collectCandidates(
  selected: Equip,
  targetAttr: ParsedStat,
  materials: string[],
): RefinementCandidate[] {
  const selfCandidate: RefinementCandidate = {
    equip: selected,
    matchAttr: targetAttr,
    matchSlotKey: 'sub1', // placeholder — self doesn't have a "matching" slot
  }

  const candidates: RefinementCandidate[] = []

  for (const candidate of equips) {
    // Same type only
    if (candidate.type !== selected.type) continue
    // Skip self
    if (candidate.id === selected.id) continue
    // Material filter
    if (materials.length > 0) {
      if (candidate.material && !materials.includes(candidate.material)) continue
    }

    const bestMatch = getCandidateBestMatch(candidate, targetAttr)
    if (!bestMatch) continue

    candidates.push({
      equip: candidate,
      matchAttr: bestMatch.matchAttr,
      matchSlotKey: bestMatch.matchSlotKey,
    })
  }

  const higherCandidates = candidates.filter(
    (c) => c.matchAttr.value > targetAttr.value,
  ).sort((a, b) => {
    const diff = b.matchAttr.value - a.matchAttr.value
    if (diff !== 0) return diff
    return a.equip.name.localeCompare(b.equip.name, 'zh-CN')
  })

  if (higherCandidates.length > 0) {
    return higherCandidates
  }

  // No higher — return self + same-value candidates (respecting material filter)
  const sameCandidates = candidates
    .filter((c) => c.matchAttr.value === targetAttr.value)
    .sort((a, b) => a.equip.name.localeCompare(b.equip.name, 'zh-CN'))

  // Include self only if its material passes the filter
  const selfMaterial = selected.material || ''
  const selfPasses =
    materials.length === 0 || !selfMaterial || materials.includes(selfMaterial)

  if (selfPasses) {
    return [selfCandidate, ...sameCandidates]
  }
  return sameCandidates
}

/**
 * Build a SlotRecommendation for a single attribute slot.
 */
export function buildSlotRecommendation(
  selected: Equip,
  slotKey: SlotKey,
  materialFilter: string[],
): SlotRecommendation {
  const targetAttr = selected[slotKey]

  if (!targetAttr || !targetAttr.stat || !Number.isFinite(targetAttr.value)) {
    return {
      slotKey,
      targetAttr,
      recommendSelf: true,
      topValueDisplay: targetAttr?.display ?? '',
      candidates: targetAttr
        ? [
            {
              equip: selected,
              matchAttr: targetAttr,
              matchSlotKey: slotKey,
            },
          ]
        : [],
      materialFilterNotice: '',
      hasHigherValues: false,
    }
  }

  const candidates = collectCandidates(selected, targetAttr, materialFilter)

  // ── Material filter notice ──────────────────────────────────────────
  let materialFilterNotice: '' | 'noCandidate' | 'mayMissBest' = ''

  if (materialFilter.length > 0) {
    if (candidates.length === 0) {
      materialFilterNotice = 'noCandidate'
    } else {
      // Compare filtered best vs unfiltered best
      const allCandidates = collectCandidates(selected, targetAttr, [])
      const filteredBest =
        candidates[0]?.matchAttr.value ?? targetAttr.value
      const allBest =
        allCandidates[0]?.matchAttr.value ?? targetAttr.value
      if (allBest > filteredBest) {
        materialFilterNotice = 'mayMissBest'
      }
    }
  }

  const topValueDisplay = candidates.length > 0
    ? candidates[0].matchAttr.display
    : targetAttr.display

  const recommendSelf =
    candidates.length > 0 &&
    !candidates.some((c) => c.matchAttr.value > (targetAttr?.value ?? 0))

  const hasHigherValues = candidates.some(
    (c) => c.matchAttr.value > (targetAttr?.value ?? 0),
  )

  return {
    slotKey,
    targetAttr,
    recommendSelf,
    topValueDisplay,
    candidates,
    materialFilterNotice,
    hasHigherValues,
  }
}

/**
 * Build all three slot recommendations for a selected equipment.
 */
export function buildRecommendations(
  selected: Equip,
  materialFilter: string[],
): SlotRecommendation[] {
  return SLOT_KEYS.map((slotKey) =>
    buildSlotRecommendation(selected, slotKey, materialFilter),
  )
}
