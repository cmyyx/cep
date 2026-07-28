/**
 * Deferred loader for the planner game dataset and the wiki character/weapon
 * summaries consumed by the growth-planner and panel-preview routes.
 *
 * `src/generated/data/planner.ts` is ~MB-scale. A static import from any client
 * module copies it into that route's chunk, producing twin multi-MB chunks per
 * route. Loading it via dynamic import() (mirroring `src/lib/game-i18n-catalogs.ts`)
 * lets the bundler emit a single shared async chunk for the whole site.
 *
 * Consumers:
 * - Page roots gate rendering with `usePlannerData()`.
 * - Descendants read synchronously via `getPlannerGameData()` /
 *   `getWikiCharacterSummaries()` / `getWikiWeaponSummaries()` — the gate
 *   guarantees the cache is populated before they render.
 */
import { useCallback, useEffect, useState } from 'react'
import type { PlannerGameData } from '@/types/planner'
import type { WikiCharacterSummary, WikiWeaponSummary } from '@/types/wiki'

export interface PlannerDataBundle {
  plannerGameData: PlannerGameData
  wikiCharacters: WikiCharacterSummary[]
  wikiWeapons: WikiWeaponSummary[]
}

type PlannerBundleImporter = () => Promise<PlannerDataBundle>

let cache: PlannerDataBundle | null = null
let inflight: Promise<PlannerDataBundle> | null = null

async function importBundle(): Promise<PlannerDataBundle> {
  const [planner, characters, weapons] = await Promise.all([
    import('@/generated/data/planner'),
    import('@/generated/data/wiki/characters'),
    import('@/generated/data/wiki/weapons'),
  ])
  return Object.freeze({
    plannerGameData: planner.plannerGameData,
    wikiCharacters: characters.wikiCharacters,
    wikiWeapons: weapons.wikiWeapons,
  })
}

let importer: PlannerBundleImporter = importBundle

/** Sync read of the loaded bundle (null until loadPlannerData resolves). */
export function getCachedPlannerData(): PlannerDataBundle | null {
  return cache
}

/** Sync read of the planner dataset (undefined until loaded). */
export function getCachedPlannerGameData(): PlannerGameData | undefined {
  return cache?.plannerGameData
}

/**
 * Load (or return cached) planner data. Safe to call repeatedly. A failed
 * attempt releases the in-flight promise, so a later call retries the import
 * (chunk 404 after a deploy, network blip, …). Callers MUST handle rejection.
 */
export function loadPlannerData(): Promise<PlannerDataBundle> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = importer()
      .then((bundle) => {
        cache = bundle
        inflight = null
        return bundle
      })
      .catch((error: unknown) => {
        inflight = null
        throw error
      })
  }
  return inflight
}

function requireBundle(): PlannerDataBundle {
  if (!cache) {
    throw new Error('Planner data not loaded — gate rendering with usePlannerData() first.')
  }
  return cache
}

/** Sync accessor for gated consumers. Throws before the bundle has loaded. */
export function getPlannerGameData(): PlannerGameData {
  return requireBundle().plannerGameData
}

/** Sync accessor for gated consumers. Throws before the bundle has loaded. */
export function getWikiCharacterSummaries(): WikiCharacterSummary[] {
  return requireBundle().wikiCharacters
}

/** Sync accessor for gated consumers. Throws before the bundle has loaded. */
export function getWikiWeaponSummaries(): WikiWeaponSummary[] {
  return requireBundle().wikiWeapons
}

export interface PlannerDataLoadState {
  /** Frozen bundle once loaded; null while loading or after a failed attempt. */
  data: PlannerDataBundle | null
  /** Set when the chunk import rejected. Cleared by retry(). */
  error: Error | null
  /** Re-run the import. Safe because a failed attempt released the in-flight promise. */
  retry: () => void
}

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason))
}

/**
 * React gating hook (mirrors useGameI18nLocale): `data` stays null until the
 * shared bundle chunk has loaded. Derives from the module cache on render; the
 * effect only updates state after the async load settles. A rejected import
 * surfaces as `error` (never an unhandled rejection) so pages can offer retry().
 */
export function usePlannerData(): PlannerDataLoadState {
  const [entry, setEntry] = useState<PlannerDataBundle | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadPlannerData().then(
      (bundle) => {
        if (cancelled) return
        setEntry(bundle)
        setError(null)
      },
      (reason: unknown) => {
        if (cancelled) return
        const err = toError(reason)
        // Report the failed planner data import to Sentry (client only).
        // Dynamic import keeps @sentry/react out of the SSG build-time graph.
        if (typeof window !== 'undefined') {
          import('@sentry/react').then((Sentry) => {
            Sentry.captureException(err, { tags: { planner_data_load: true } })
          }).catch(() => { /* Sentry unavailable — swallow */ })
        }
        setError(err)
      },
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setError(null)
    setAttempt((value) => value + 1)
  }, [])

  // A populated cache always wins: if some other caller's attempt succeeded,
  // this hook must render data rather than a stale error panel.
  return { data: cache ?? entry, error: cache ? null : error, retry }
}

/** Test helper */
export function resetPlannerDataCacheForTests(): void {
  cache = null
  inflight = null
  importer = importBundle
}

/** Test helper: swap the chunk importer to simulate a failed dynamic import. */
export function setPlannerDataImporterForTests(next: PlannerBundleImporter | null): void {
  importer = next ?? importBundle
}
