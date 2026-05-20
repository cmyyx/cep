'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useMatrixStore } from '@/stores/useMatrixStore'
import { useRefinementStore } from '@/stores/useRefinementStore'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { getSyncDataApi, postSyncDataApi, getTokens } from '@/lib/api'
import type { Weapon } from '@/types/matrix'
import { regionI18nKey } from '@/data/region-i18n'

const PUSH_DEBOUNCE_MS = 8000
const PULL_INTERVAL_MS = 5 * 60 * 1000

/**
 * Writes cloud-sync payload data into all three Zustand stores' in-memory state.
 * Call this AFTER writing the same data to localStorage to keep UI in sync.
 * This is needed because Zustand persist only hydrates once on store creation;
 * external localStorage writes don't trigger re-hydration in the same tab.
 */
function syncStoresFromCloudPayload(raw: Record<string, unknown>) {
  try {
    const ep = raw.essencePlanner as Record<string, unknown> | undefined
    if (ep) {
      useMatrixStore.setState({
        selectedWeaponIds: (Array.isArray(ep.selectedWeaponIds) ? ep.selectedWeaponIds : []) as string[],
        dungeonS1Selections: (ep.dungeonS1Selections ?? {}) as Record<string, string[]>,
      })
    }
  } catch { /* ignore */ }

  try {
    const es = raw.essenceSettings as Record<string, unknown> | undefined
    if (es) {
      const next: Record<string, unknown> = {}
      if (es.weaponOwnership) next.weaponOwnership = es.weaponOwnership
      if (es.essenceStatus) next.essenceStatus = es.essenceStatus
      if (es.weaponNotes) next.weaponNotes = es.weaponNotes
      if (Array.isArray(es.customWeapons)) next.customWeapons = es.customWeapons
      if (es.flags) Object.assign(next, es.flags)
      if (es.regionFirst !== undefined) next.regionFirst = es.regionFirst
      if (es.regionSecond !== undefined) next.regionSecond = es.regionSecond
      if (Object.keys(next).length > 0) {
        useEssenceSettingsStore.setState(next as Partial<ReturnType<typeof useEssenceSettingsStore.getState>>)
      }
    }
  } catch { /* ignore */ }

  try {
    const rp = raw.refinementPlanner as Record<string, unknown> | undefined
    if (rp && rp.selectedEquipId !== undefined) {
      useRefinementStore.setState({
        selectedEquipId: rp.selectedEquipId as string | null,
      })
    }
  } catch { /* ignore */ }
}

// ── Conflict detection helpers ────────────────────────────

function hasExistingLocalData(local: Record<string, unknown>): boolean {
  const ep = local.essencePlanner as Record<string, unknown> | undefined
  if (ep && Array.isArray(ep.selectedWeaponIds) && ep.selectedWeaponIds.length > 0) return true
  const es = local.essenceSettings as Record<string, unknown> | undefined
  if (es) {
    const wo = es.weaponOwnership as Record<string, unknown> | undefined
    if (wo && Object.keys(wo).length > 0) return true
    const ess = es.essenceStatus as Record<string, unknown> | undefined
    if (ess && Object.keys(ess).length > 0) return true
    const cw = es.customWeapons as unknown[] | undefined
    if (Array.isArray(cw) && cw.length > 0) return true
    const wn = es.weaponNotes as Record<string, unknown> | undefined
    if (wn && Object.keys(wn).length > 0) return true
  }
  const rp = local.refinementPlanner as Record<string, unknown> | undefined
  if (rp && rp.selectedEquipId) return true
  return false
}

function syncDataDiffers(local: Record<string, unknown>, cloud: Record<string, unknown>): boolean {
  const keys = ['essencePlanner', 'essenceSettings', 'refinementPlanner'] as const
  for (const key of keys) {
    if (JSON.stringify(normalizeForCompare(local[key])) !== JSON.stringify(normalizeForCompare(cloud[key]))) return true
  }
  return false
}

/** Normalize data for comparison: strip false values, empty objects → null */
function normalizeForCompare(v: unknown): unknown {
  if (v == null) return null
  if (Array.isArray(v)) return v
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(obj)) {
      if (val === false) continue
      if (typeof val === 'object' && val !== null) {
        const nested = normalizeForCompare(val)
        if (nested !== null) out[k] = nested
      } else {
        out[k] = val
      }
    }
    if (Object.keys(out).length === 0) return null
    return out
  }
  return v
}

/** Build human-readable comparison rows from sync data */
function buildSummaryRows(data: Record<string, unknown>): Record<string, string> {
  const ep = data.essencePlanner as Record<string, unknown> | undefined
  const es = data.essenceSettings as Record<string, unknown> | undefined
  const rp = data.refinementPlanner as Record<string, unknown> | undefined
  return {
    weapons: String(Array.isArray(ep?.selectedWeaponIds) ? ep!.selectedWeaponIds.length : 0),
    equip: (rp?.selectedEquipId ?? '') as string,
    ownership: String(Object.keys((es?.weaponOwnership ?? {}) as object).length),
    essence: String(Object.keys((es?.essenceStatus ?? {}) as object).length),
    customWeapons: String(Array.isArray(es?.customWeapons) ? es!.customWeapons.length : 0),
    weaponNotes: String(Object.keys((es?.weaponNotes ?? {}) as object).length),
  }
}

/** Map flag keys (hideEssenceOwnedWeaponsList) → i18n base key (hideEssenceOwned) */
const FLAG_TO_I18N: Record<string, string> = {
  hideEssenceOwnedWeaponsList: 'hideEssenceOwned',
  hideEssenceOwnedWeaponsPlans: 'hideEssenceOwned',
  hideUnownedWeaponsList: 'hideUnowned',
  hideUnownedWeaponsPlans: 'hideUnowned',
  hideFourStarWeaponsList: 'hideFourStar',
  hideFourStarWeaponsPlans: 'hideFourStar',
  enableOwnershipEditList: 'enableOwnershipEdit',
  enableOwnershipEditPlans: 'enableOwnershipEdit',
  enableNotesList: 'enableNotes',
  enableNotesPlans: 'enableNotes',
  keepUpVisibleList: 'keepUpVisible',
  keepUpVisiblePlans: 'keepUpVisible',
  onlyHideWhenBothOwned: 'onlyHideWhenBothOwned',
}

/** Suffix for list vs plans context */
function flagContextSuffix(k: string): string {
  return k.endsWith('List') ? '（武器列表）' : k.endsWith('Plans') ? '（方案推荐）' : ''
}

/** Settings diff entry for collapsible section */
export interface SettingsDiffEntry {
  i18nKey: string
  localVal: string
  cloudVal: string
  /** If true, display val directly; if false, use t(`account.${val}`) */
  rawVal?: boolean
  suffix?: string
}

/** Compare settings fields, return only entries that differ */
function buildSettingsDiff(local: Record<string, unknown>, cloud: Record<string, unknown>): SettingsDiffEntry[] {
  const result: SettingsDiffEntry[] = []
  const esL = (local.essenceSettings ?? {}) as Record<string, unknown>
  const esC = (cloud.essenceSettings ?? {}) as Record<string, unknown>

  // Flags
  const flagKeys = [
    'hideEssenceOwnedWeaponsList', 'hideEssenceOwnedWeaponsPlans',
    'hideUnownedWeaponsList', 'hideUnownedWeaponsPlans',
    'hideFourStarWeaponsList', 'hideFourStarWeaponsPlans',
    'enableOwnershipEditList', 'enableOwnershipEditPlans',
    'enableNotesList', 'enableNotesPlans',
    'keepUpVisibleList', 'keepUpVisiblePlans',
    'onlyHideWhenBothOwned',
  ]
  const flagsL = (esL.flags ?? {}) as Record<string, unknown>
  const flagsC = (esC.flags ?? {}) as Record<string, unknown>
  for (const k of flagKeys) {
    const lv = !!flagsL[k]
    const cv = !!flagsC[k]
    if (lv !== cv) {
      const baseKey = FLAG_TO_I18N[k] ?? k
      const suffix = flagContextSuffix(k)
      result.push({ i18nKey: `essenceSettings.${baseKey}`, localVal: lv ? 'on' : 'off', cloudVal: cv ? 'on' : 'off', suffix })
    }
  }

  // Region priorities — use i18n keys directly as values
  const r1L = typeof esL.regionFirst === 'string' ? esL.regionFirst : ''
  const r1C = typeof esC.regionFirst === 'string' ? esC.regionFirst : ''
  if (r1L !== r1C) {
    result.push({ i18nKey: 'essenceSettings.regionFirstLabel', localVal: r1L ? regionI18nKey(r1L) : 'account.none', cloudVal: r1C ? regionI18nKey(r1C) : 'account.none', rawVal: true })
  }
  const r2L = typeof esL.regionSecond === 'string' ? esL.regionSecond : ''
  const r2C = typeof esC.regionSecond === 'string' ? esC.regionSecond : ''
  if (r2L !== r2C) {
    result.push({ i18nKey: 'essenceSettings.regionSecondLabel', localVal: r2L ? regionI18nKey(r2L) : 'account.none', cloudVal: r2C ? regionI18nKey(r2C) : 'account.none', rawVal: true })
  }

  return result
}

export interface SyncConflictInfo {
  type: 'pull_conflict' | 'push_conflict'
  localSummary: Record<string, string>
  cloudSummary: Record<string, string>
  settingsDiff?: SettingsDiffEntry[]
  cloudVersion: number
  cloudUpdatedAt: string | null
  /** Call with 'cloud' to overwrite local with cloud data, or 'local' to keep local */
  resolve: (choice: 'cloud' | 'local') => void
}

type ConflictCallback = (info: SyncConflictInfo) => void
type SyncNotifyCallback = (event: { type: 'push_success' | 'push_conflict' | 'pull_conflict' | 'sync_error'; message?: string }) => void

let _conflictCallback: ConflictCallback | null = null
let _notifyCallback: SyncNotifyCallback | null = null

export function setAutoSyncConflictCallback(cb: ConflictCallback | null) {
  _conflictCallback = cb
}

export function setAutoSyncNotifyCallback(cb: SyncNotifyCallback | null) {
  _notifyCallback = cb
}

/** Export for manual sync (AccountPage) — syncs all three Zustand stores from raw cloud payload */
export { syncStoresFromCloudPayload, hasExistingLocalData, syncDataDiffers, buildSummaryRows, buildSettingsDiff }

function notifySync(event: Parameters<SyncNotifyCallback>[0]) {
  _notifyCallback?.(event)
}

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

export function updateLastPull(cloudUpdatedAt?: string | null) {
  globalTimestamps = { lastPullAt: Date.now(), cloudUpdatedAt: cloudUpdatedAt ?? globalTimestamps.cloudUpdatedAt }
  notifyTimestamps()
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
  const premiumTrialUntil = useAuthStore(s => s.premiumTrialUntil)
  const premiumUntil = useAuthStore(s => s.premiumUntil)
  const now = Date.now()
  const trialUntil = premiumTrialUntil ? new Date(premiumTrialUntil).getTime() : 0
  const premUntil = premiumUntil ? new Date(premiumUntil).getTime() : 0
  const hasAutoSync = planTier === 'premium' || trialUntil > now || premUntil > now
  const autoSyncEnabled = useEssenceSettingsStore(s => s.autoSyncEnabled)
  const notifyOnSync = useEssenceSettingsStore(s => s.notifyOnSync)

  const cloudVersionRef = useRef<number>(0)
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pullTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dirtyRef = useRef(false)
  const firstPullDoneRef = useRef(false)
  const pullCompletedRef = useRef(false)
  // Prevent auto-push right after we programmatically wrote pulled data to localStorage.
  // Using a ref (not boolean) so multiple synchronous subscribe callbacks all see it before reset.
  const skipPushRef = useRef(false)

  // ── Write cloud data into localStorage + sync Zustand stores so UI updates immediately ──
  const writeCloudToLocalStorage = (raw: Record<string, unknown>) => {
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
    // Sync Zustand stores so UI reflects changes without page refresh
    syncStoresFromCloudPayload(raw)
  }

  // ── Pull from cloud ────────────────────────────────────
  const pullFromCloud = useCallback(async () => {
    if (!getTokens().accessToken) return
    try {
      const res = await getSyncDataApi()
      pullCompletedRef.current = true
      const raw = res.data as Record<string, unknown> | null
      if (!raw) {
        cloudVersionRef.current = res.version
        globalTimestamps = { lastPullAt: Date.now(), cloudUpdatedAt: res.updatedAt }
        notifyTimestamps()
        return
      }

      // ── Conflict detection: if local has existing data that differs from cloud ──
      const localData = collectSyncData()
      if (hasExistingLocalData(localData) && syncDataDiffers(localData, raw)) {
        const localRows = buildSummaryRows(localData)
        const cloudRows = buildSummaryRows(raw)
        const settingsDiff = buildSettingsDiff(localData, raw)
        if (_conflictCallback) {
          _conflictCallback({
            type: 'pull_conflict',
            localSummary: localRows,
            cloudSummary: cloudRows,
            settingsDiff: settingsDiff.length > 0 ? settingsDiff : undefined,
            cloudVersion: res.version,
            cloudUpdatedAt: res.updatedAt,
            resolve: (choice) => {
              if (choice === 'cloud') {
                skipPushRef.current = true
                writeCloudToLocalStorage(raw)
                Promise.resolve().then(() => { skipPushRef.current = false })
              }
              // Either way, accept the cloud version so subsequent pushes don't conflict
              cloudVersionRef.current = res.version
              globalTimestamps = { lastPullAt: Date.now(), cloudUpdatedAt: res.updatedAt }
              notifyTimestamps()
            },
          })
        } else {
          // No callback registered — notify globally so other pages can show a toast
          globalTimestamps = { lastPullAt: Date.now(), cloudUpdatedAt: res.updatedAt }
          notifyTimestamps()
          notifySync({ type: 'pull_conflict' })
        }
        return // Don't overwrite silently — wait for user decision
      }

      // ── No conflict: write cloud data into localStorage stores ──
      skipPushRef.current = true
      writeCloudToLocalStorage(raw)
      // Reset after all synchronous store subscription callbacks have fired
      Promise.resolve().then(() => { skipPushRef.current = false })
      cloudVersionRef.current = res.version
      globalTimestamps = {
        lastPullAt: Date.now(),
        cloudUpdatedAt: res.updatedAt,
      }
      notifyTimestamps()
    } catch {
      pullCompletedRef.current = true
    }
  }, []) // stable — reads token from localStorage at call time

  // ── Push to cloud ──────────────────────────────────────
  const pushToCloud = useCallback(async () => {
    if (!getTokens().accessToken || !dirtyRef.current || !pullCompletedRef.current) return
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
      }, 'auto')
      cloudVersionRef.current = res.version
      notifySync({ type: 'push_success' })
    } catch (err) {
      if (err instanceof Error && err.message === 'version_conflict') {
        // Fetch latest cloud data so the dialog can show actual cloud state
        try {
          const latest = await getSyncDataApi()
          const cloudRaw = latest.data as Record<string, unknown> | null
          const localData = collectSyncData()
          const localRows = buildSummaryRows(localData)
          const cloudRows = cloudRaw ? buildSummaryRows(cloudRaw) : { weapons: '0', equip: '', ownership: '0', essence: '0', customWeapons: '0', weaponNotes: '0' }
          const settingsDiff = cloudRaw ? buildSettingsDiff(localData, cloudRaw) : []
          if (_conflictCallback) {
            _conflictCallback({
              type: 'push_conflict',
              localSummary: localRows,
              cloudSummary: cloudRows,
              settingsDiff: settingsDiff.length > 0 ? settingsDiff : undefined,
              cloudVersion: latest.version,
              cloudUpdatedAt: latest.updatedAt,
              resolve: (choice) => {
                if (choice === 'cloud' && cloudRaw) {
                  skipPushRef.current = true
                  writeCloudToLocalStorage(cloudRaw)
                  Promise.resolve().then(() => { skipPushRef.current = false })
                }
                if (choice === 'local') {
                  // User wants to overwrite cloud with local — retry push immediately
                  cloudVersionRef.current = latest.version
                  dirtyRef.current = true
                  pushToCloud()
                } else {
                  cloudVersionRef.current = latest.version
                }
                globalTimestamps = { lastPullAt: Date.now(), cloudUpdatedAt: latest.updatedAt }
                notifyTimestamps()
              },
            })
          } else {
            notifySync({ type: 'push_conflict' })
          }
        } catch {
          notifySync({ type: 'sync_error' })
        }
      }
      // Non-version-conflict errors are silently ignored (network issues, etc.)
    }
  }, []) // stable — reads token from localStorage at call time

  // ── Debounced push trigger ─────────────────────────────
  const schedulePush = useCallback(() => {
    if (skipPushRef.current) return
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

    if (hasAutoSync && autoSyncEnabled) {
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
  }, [accessToken, hasAutoSync, autoSyncEnabled]) // pullFromCloud is stable (useCallback with [])

  // ── Watch stores for changes (Premium + autoSyncEnabled only) ────────────
  useEffect(() => {
    if (!hasAutoSync || !autoSyncEnabled) return

    const unsubs: (() => void)[] = []

    // Subscribe to each store — Zustand's subscribe fires on every state change
    unsubs.push(useMatrixStore.subscribe(() => schedulePush()))
    unsubs.push(useRefinementStore.subscribe(() => schedulePush()))
    unsubs.push(useEssenceSettingsStore.subscribe(() => schedulePush()))

    return () => { for (const u of unsubs) u() }
  }, [hasAutoSync, autoSyncEnabled]) // schedulePush is stable

  // ── Cleanup on unmount ─────────────────────────────────
  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
      if (pullTimerRef.current) clearInterval(pullTimerRef.current)
    }
  }, [])

  return { pullFromCloud, pushToCloud }
}
