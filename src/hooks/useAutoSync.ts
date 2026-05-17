'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useMatrixStore } from '@/stores/useMatrixStore'
import { useRefinementStore } from '@/stores/useRefinementStore'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { getSyncDataApi, postSyncDataApi, getTokens } from '@/lib/api'

const PUSH_DEBOUNCE_MS = 8000
const PULL_INTERVAL_MS = 5 * 60 * 1000

function collectSyncData(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  const data: Record<string, unknown> = {}
  try {
    const r = localStorage.getItem('matrix-session')
    if (r) {
      const p = JSON.parse(r); const s = p?.state ?? p
      data.essencePlanner = { selectedWeaponIds: s.selectedWeaponIds ?? [], dungeonS1Selections: s.dungeonS1Selections ?? {} }
    }
  } catch { /* ignore */ }
  try {
    const r = localStorage.getItem('essence-settings')
    if (r) {
      const p = JSON.parse(r); const s = p?.state ?? p
      data.essenceSettings = {
        weaponOwnership: s.weaponOwnership ?? {}, essenceStatus: s.essenceStatus ?? {},
        weaponNotes: s.weaponNotes ?? {}, customWeapons: s.customWeapons ?? [],
        flags: Object.fromEntries(['hideEssenceOwnedWeaponsList', 'hideEssenceOwnedWeaponsPlans', 'hideUnownedWeaponsList', 'hideUnownedWeaponsPlans', 'hideFourStarWeaponsList', 'hideFourStarWeaponsPlans', 'enableOwnershipEditList', 'enableOwnershipEditPlans', 'enableNotesList', 'enableNotesPlans', 'keepUpVisibleList', 'keepUpVisiblePlans', 'onlyHideWhenBothOwned'].map(k => [k, s[k] ?? false])),
        regionFirst: s.regionFirst ?? null, regionSecond: s.regionSecond ?? null,
      }
    }
  } catch { /* ignore */ }
  try {
    const r = localStorage.getItem('refinement-session')
    if (r) {
      const p = JSON.parse(r); const s = p?.state ?? p
      data.refinementPlanner = { selectedEquipId: s.selectedEquipId ?? null }
    }
  } catch { /* ignore */ }
  return data
}

interface SyncTimestamps {
  lastPullAt: number | null
  cloudUpdatedAt: string | null
}

let globalTimestamps: SyncTimestamps = { lastPullAt: null, cloudUpdatedAt: null }
const listeners = new Set<() => void>()

export function getSyncTimestamps(): SyncTimestamps {
  return { ...globalTimestamps }
}

export function subscribeSyncTimestamps(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function notifyTimestamps() {
  for (const fn of listeners) fn()
}

/**
 * Auto-sync manager. Should be mounted once in the app shell.
 * - Premium: auto-push (debounced 8s) + auto-pull (5min interval + on focus)
 * - Free: one-time pull on login, then manual only
 */
export function useAutoSync() {
  const accessToken = useAuthStore(s => s.accessToken)
  const planTier = useAuthStore(s => s.planTier)
  const isPremium = planTier === 'premium'

  const cloudVersionRef = useRef<number>(0)
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pullTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dirtyRef = useRef(false)
  const firstPullDoneRef = useRef(false)

  // ── Pull from cloud ────────────────────────────────────
  const pullFromCloud = useCallback(async () => {
    if (!getTokens().accessToken) return
    try {
      const res = await getSyncDataApi()
      const raw = res.data as Record<string, unknown> | null
      if (raw) {
        // Write cloud data into localStorage stores
        try {
          const ep = raw.essencePlanner as Record<string, unknown> | undefined
          if (ep) {
            const current = JSON.parse(localStorage.getItem('matrix-session') || '{}')
            const state = current?.state ?? current
            if (Array.isArray(ep.selectedWeaponIds)) state.selectedWeaponIds = ep.selectedWeaponIds
            if (ep.dungeonS1Selections) state.dungeonS1Selections = ep.dungeonS1Selections
            localStorage.setItem('matrix-session', JSON.stringify({ ...current, state }))
          }
        } catch { /* ignore */ }
        try {
          const es = raw.essenceSettings as Record<string, unknown> | undefined
          if (es) {
            const current = JSON.parse(localStorage.getItem('essence-settings') || '{}')
            const state = current?.state ?? current
            if (es.weaponOwnership) state.weaponOwnership = es.weaponOwnership
            if (es.essenceStatus) state.essenceStatus = es.essenceStatus
            if (es.weaponNotes) state.weaponNotes = es.weaponNotes
            if (Array.isArray(es.customWeapons)) state.customWeapons = es.customWeapons
            if (es.flags) Object.assign(state, es.flags)
            if (es.regionFirst !== undefined) state.regionFirst = es.regionFirst
            if (es.regionSecond !== undefined) state.regionSecond = es.regionSecond
            localStorage.setItem('essence-settings', JSON.stringify({ ...current, state }))
          }
        } catch { /* ignore */ }
        try {
          const rp = raw.refinementPlanner as Record<string, unknown> | undefined
          if (rp) {
            const current = JSON.parse(localStorage.getItem('refinement-session') || '{}')
            const state = current?.state ?? current
            if (rp.selectedEquipId !== undefined) state.selectedEquipId = rp.selectedEquipId
            localStorage.setItem('refinement-session', JSON.stringify({ ...current, state }))
          }
        } catch { /* ignore */ }
      }
      cloudVersionRef.current = res.version
      globalTimestamps = {
        lastPullAt: Date.now(),
        cloudUpdatedAt: res.updatedAt,
      }
      notifyTimestamps()
    } catch { /* ignore */ }
  }, []) // stable — reads token from localStorage at call time

  // ── Push to cloud ──────────────────────────────────────
  const pushToCloud = useCallback(async () => {
    if (!getTokens().accessToken || !dirtyRef.current) return
    dirtyRef.current = false
    try {
      const localData = collectSyncData()
      const res = await postSyncDataApi({
        base_version: cloudVersionRef.current,
        data: {
          schemaVersion: 2,
          capturedAt: new Date().toISOString(),
          ...localData,
        },
      })
      cloudVersionRef.current = res.version
    } catch { /* ignore conflict — next pull will resolve */ }
  }, []) // stable — reads token from localStorage at call time

  // ── Debounced push trigger ─────────────────────────────
  const schedulePush = useCallback(() => {
    dirtyRef.current = true
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(() => pushToCloud(), PUSH_DEBOUNCE_MS)
  }, []) // pushToCloud is stable

  // ── First-login pull + auto-pull setup ─────────────────
  useEffect(() => {
    if (!accessToken) return
    if (!firstPullDoneRef.current) {
      firstPullDoneRef.current = true
      pullFromCloud()
    }

    if (isPremium) {
      // Auto-pull interval
      pullTimerRef.current = setInterval(pullFromCloud, PULL_INTERVAL_MS)

      // Pull on visibility change (user returns to tab)
      const onVisible = () => {
        if (document.visibilityState === 'visible') pullFromCloud()
      }
      document.addEventListener('visibilitychange', onVisible)

      return () => {
        if (pullTimerRef.current) clearInterval(pullTimerRef.current)
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
  }, [accessToken, isPremium]) // pullFromCloud is stable (useCallback with [])

  // ── Watch stores for changes (Premium only) ────────────
  useEffect(() => {
    if (!isPremium) return

    const unsubs: (() => void)[] = []

    // Subscribe to each store — Zustand's subscribe fires on every state change
    unsubs.push(useMatrixStore.subscribe(() => schedulePush()))
    unsubs.push(useRefinementStore.subscribe(() => schedulePush()))
    unsubs.push(useEssenceSettingsStore.subscribe(() => schedulePush()))

    return () => { for (const u of unsubs) u() }
  }, [isPremium]) // schedulePush is stable

  // ── Cleanup on unmount ─────────────────────────────────
  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
      if (pullTimerRef.current) clearInterval(pullTimerRef.current)
    }
  }, [])

  return { pullFromCloud, pushToCloud }
}
