// Extracts stat/attribute terms from AKEData GemTable and WorldEnergyPointGroupTable.
// These are the gem term IDs used in dungeon S2/S3 pools.
// Translations come from GemTable.tagName.id → TextTable lookup.
// Uses raw regex extraction for all int64 text IDs to avoid truncation.
// ================================================================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractGemTermTextIds } from './extract-textid'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StatCompareResult {
  primaryStats: string[]      // S1 pool gem term IDs (primAttrTermIds)
  secondaryStats: string[]    // S2 pool gem term IDs (secAttrTermIds)
  skillTerms: string[]        // S3 pool gem term IDs (skillTermIds)
  allTerms: string[]          // all unique gem term IDs
  textIdMap: Record<string, string>  // gemTermId → TextTable ID (from GemTable.tagName.id)
}

// ── Main extractor ────────────────────────────────────────────────────────────

export function extractStats(
  akedataPath: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _weaponBasicTable: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _equipItemTable?: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _textTableCN?: Record<string, string>,
): StatCompareResult {
  const primaryStats = new Set<string>()
  const secondaryStats = new Set<string>()
  const skillTerms = new Set<string>()

  // ── Extract gem term text IDs from raw JSON (avoids int64 truncation) ──
  const gemTablePath = join(akedataPath, 'TableCfg', 'GemTable.json')
  const textIdMap = extractGemTermTextIds(gemTablePath)

  // ── Read WorldEnergyPointGroupTable for term pools ──
  const groupTablePath = join(akedataPath, 'TableCfg', 'WorldEnergyPointGroupTable.json')
  if (existsSync(groupTablePath)) {
    const groupTable = JSON.parse(readFileSync(groupTablePath, 'utf-8')) as Record<string, Record<string, unknown>>
    for (const [, gData] of Object.entries(groupTable)) {
      const primTerms = (gData.primAttrTermIds ?? []) as string[]
      const secTerms = (gData.secAttrTermIds ?? []) as string[]
      const skillTermsList = (gData.skillTermIds ?? []) as string[]

      for (const t of primTerms) primaryStats.add(t)
      for (const t of secTerms) secondaryStats.add(t)
      for (const t of skillTermsList) skillTerms.add(t)
    }
  }

  const allTerms = [...new Set([...primaryStats, ...secondaryStats, ...skillTerms])].sort()

  return {
    primaryStats: [...primaryStats].sort(),
    secondaryStats: [...secondaryStats].sort(),
    skillTerms: [...skillTerms].sort(),
    allTerms,
    textIdMap,
  }
}
