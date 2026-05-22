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
 * Check whether auto-sync is currently permitted for this user.
 * Reads from Zustand stores at call time so it always sees the latest
 * state — safe to call from store subscribers / event handlers regardless
 * of React render timing.
 */
function shouldAutoSync(): boolean {
  const settings = useEssenceSettingsStore.getState()
  if (!settings.autoSyncEnabled) return false
  const auth = useAuthStore.getState()
  const now = Date.now()
  const trialUntil = auth.premiumTrialUntil ? new Date(auth.premiumTrialUntil).getTime() : 0
  const premUntil = auth.premiumUntil ? new Date(auth.premiumUntil).getTime() : 0
  return auth.planTier === 'premium' || trialUntil > now || premUntil > now
}

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
        // Mark plans as stale so EssencePlanner page re-computes on next visit.
        // This also prevents the stale-plan-triggered computePlans() from firing
        // a spurious auto-push after cloud data sync.
        plansStale: true,
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

/** Suffix for list vs plans context (i18n key) */
function flagContextSuffix(k: string): string {
  return k.endsWith('List') ? 'account.weaponListSuffix' : k.endsWith('Plans') ? 'account.planRecommendationSuffix' : ''
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
  resolve: (choice: 'cloud' | 'local') => void | Promise<void>
}

type ConflictCallback = (info: SyncConflictInfo) => void
type SyncNotifyCallback = (event: { type: 'push_success' | 'push_unchanged' | 'push_conflict' | 'pull_success' | 'pull_conflict' | 'sync_error'; message?: string }) => void

let _conflictCallback: ConflictCallback | null = null
let _notifyCallback: SyncNotifyCallback | null = null

/** Conflict that occurred while the Account page was not yet mounted. */
let _pendingConflict: SyncConflictInfo | null = null

/** Callback to dismiss the conflict toast from the Account page after resolving. */
let _dismissConflictToast: (() => void) | null = null

export function getPendingConflict(): SyncConflictInfo | null {
  return _pendingConflict
}

export function clearPendingConflict() {
  _pendingConflict = null
}

export function setDismissConflictToast(cb: (() => void) | null) {
  _dismissConflictToast = cb
}

export function dismissConflictToast() {
  _dismissConflictToast?.()
}

// Shared skip-push ref — set by Account page when writing cloud data to avoid
// the auto-sync immediately pushing the same data back.
const _skipPushRef = { current: false }

/** Set when a sync conflict dialog is currently open and unresolved.
 *  While true, auto-push is blocked so it can't bypass the conflict. */
const _conflictPendingRef = { current: false }

export function setSkipNextPush(v: boolean) {
  _skipPushRef.current = v
}

/** Check whether an unresolved conflict is blocking auto-sync. */
export function isConflictPending(): boolean {
  return _conflictPendingRef.current
}

/** Called when a conflict dialog is shown — blocks auto-push until resolved. */
export function setConflictPending(v: boolean) {
  _conflictPendingRef.current = v
}

/** Compute a deterministic signature of sync data. Two payloads that
 *  syncDataDiffers considers "same" produce identical signatures. */
export function computeSyncSignature(data: Record<string, unknown>): string {
  // Only compare planner data — ignore wrapper fields (schemaVersion, capturedAt)
  // so cloud payloads and local payloads produce identical signatures.
  const slim: Record<string, unknown> = {}
  if (data.essencePlanner !== undefined) slim.essencePlanner = data.essencePlanner
  if (data.essenceSettings !== undefined) slim.essenceSettings = data.essenceSettings
  if (data.refinementPlanner !== undefined) slim.refinementPlanner = data.refinementPlanner
  return JSON.stringify(normalizeForCompare(slim))
}

/** Returns the signature of the data as it stood after the last successful sync
 *  (push or pull).  null means "never synced". */
export function getLastSyncSignature(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem('cep-last-sync-sig') } catch { return null }
}

/** Persist the sync signature so future pulls can tell whether local data was
 *  modified since the last sync. */
export function setLastSyncSignature(sig: string) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem('cep-last-sync-sig', sig) } catch {}
}

export function setAutoSyncConflictCallback(cb: ConflictCallback | null) {
  _conflictCallback = cb
}

export function setAutoSyncNotifyCallback(cb: SyncNotifyCallback | null) {
  _notifyCallback = cb
}

/** Export for manual sync (AccountPage) — syncs all three Zustand stores from raw cloud payload */
export { syncStoresFromCloudPayload, hasExistingLocalData, syncDataDiffers, buildSummaryRows, buildSettingsDiff }

/** Fire a toast notification — also exported for manual sync triggers. */
export function notifySync(event: Parameters<SyncNotifyCallback>[0]) {
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

/** Cached result of the most recent successful pull. Shared so Account page
 *  can reuse it instead of making its own GET on mount. */
let _lastPullResult: { data: unknown; version: number; updatedAt: string | null } | null = null

/** Subscribe to pull completions — fires after every successful pullFromCloud. */
const _pullListeners = new Set<() => void>()

export function getLastPullResult() {
  return _lastPullResult
}

export function subscribePullResult(fn: () => void): () => void {
  _pullListeners.add(fn)
  return () => { _pullListeners.delete(fn) }
}

function notifyPullResult() {
  for (const fn of _pullListeners) fn()
}

/** Shared cloud version — accessed by both auto-sync hook and Account page to avoid dual-track drift. */
let _cloudVersion = 0

export function getCloudVersion(): number {
  return _cloudVersion
}

export function updateCloudVersion(v: number): void {
  _cloudVersion = v
  notifyTimestamps()
}

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

  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pullTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dirtyRef = useRef(false)
  const firstPullDoneRef = useRef(false)
  const pullCompletedRef = useRef(false)

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
    if (!getTokens().accessToken) {
      // Token not yet available — mark pull as "completed" so it doesn't
      // permanently block auto-pushes. The first real pull will happen
      // once the token becomes available and the effect re-runs.
      pullCompletedRef.current = true
      return
    }
    try {
      const res = await getSyncDataApi()
      // Cache result so Account page can reuse it instead of making its own GET
      _lastPullResult = { data: res.data, version: res.version, updatedAt: res.updatedAt }
      notifyPullResult()
      const raw = res.data as Record<string, unknown> | null
      if (!raw) {
        pullCompletedRef.current = true
        _cloudVersion = res.version
        globalTimestamps = { lastPullAt: Date.now(), cloudUpdatedAt: res.updatedAt }
        notifyTimestamps()
        return
      }

      // ── Conflict detection: if local has existing data that differs from cloud ──
      const localData = collectSyncData()
      if (hasExistingLocalData(localData) && syncDataDiffers(localData, raw)) {
        // If local data hasn't changed since last sync, this is a normal
        // cross-device update — apply cloud data silently, no conflict dialog.
        const lastSig = getLastSyncSignature()
        if (lastSig !== null && computeSyncSignature(localData) === lastSig) {
          _skipPushRef.current = true
          writeCloudToLocalStorage(raw)
          Promise.resolve().then(() => { _skipPushRef.current = false })
          _cloudVersion = res.version
          setLastSyncSignature(computeSyncSignature(raw))
          pullCompletedRef.current = true
          globalTimestamps = { lastPullAt: Date.now(), cloudUpdatedAt: res.updatedAt }
          notifyTimestamps()
          if (useEssenceSettingsStore.getState().notifyOnPull) notifySync({ type: 'pull_success' })
          return
        }
        // If cloud hasn't changed since last sync, local-only modifications
        // are not a conflict — just pending data waiting to be pushed.
        // EXCEPTION: if a conflict dialog is already open, don't silently
        // unlock the push — a prior genuine conflict is still unresolved.
        if (lastSig !== null && computeSyncSignature(raw) === lastSig) {
          if (_conflictPendingRef.current) {
            // Conflict still pending — refresh the dialog with current data
            // rather than silently completing the pull.
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
                  _conflictPendingRef.current = false
                  if (choice === 'cloud') {
                    _skipPushRef.current = true
                    writeCloudToLocalStorage(raw)
                    Promise.resolve().then(() => { _skipPushRef.current = false })
                    _cloudVersion = res.version
                    setLastSyncSignature(computeSyncSignature(raw))
                    pullCompletedRef.current = true
                  }
                  if (choice === 'local') {
                    _cloudVersion = res.version
                    dirtyRef.current = true
                    pullCompletedRef.current = true
                    return pushToCloud()
                  }
                  globalTimestamps = { lastPullAt: Date.now(), cloudUpdatedAt: res.updatedAt }
                  notifyTimestamps()
                },
              })
            }
            return
          }
          _cloudVersion = res.version
          pullCompletedRef.current = true
          return
        }
        // Genuine conflict — don't set pullCompletedRef; block auto-push until resolved
        _conflictPendingRef.current = true
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
              _conflictPendingRef.current = false
              if (choice === 'cloud') {
                _skipPushRef.current = true
                writeCloudToLocalStorage(raw)
                Promise.resolve().then(() => { _skipPushRef.current = false })
                _cloudVersion = res.version
                setLastSyncSignature(computeSyncSignature(raw))
                pullCompletedRef.current = true
              }
              if (choice === 'local') {
                // Push local data to cloud immediately
                _cloudVersion = res.version
                dirtyRef.current = true
                pullCompletedRef.current = true
                return pushToCloud()
              }
              globalTimestamps = { lastPullAt: Date.now(), cloudUpdatedAt: res.updatedAt }
              notifyTimestamps()
            },
          })
        } else {
          // No callback registered — stash conflict for when Account page mounts
          _pendingConflict = {
            type: 'pull_conflict',
            localSummary: localRows,
            cloudSummary: cloudRows,
            settingsDiff: settingsDiff.length > 0 ? settingsDiff : undefined,
            cloudVersion: res.version,
            cloudUpdatedAt: res.updatedAt,
            resolve: (choice: 'cloud' | 'local') => {
              _conflictPendingRef.current = false
              if (choice === 'cloud') {
                _skipPushRef.current = true
                writeCloudToLocalStorage(raw)
                Promise.resolve().then(() => { _skipPushRef.current = false })
                _cloudVersion = res.version
                setLastSyncSignature(computeSyncSignature(raw))
                pullCompletedRef.current = true
              }
              if (choice === 'local') {
                // Push local data to cloud immediately
                _cloudVersion = res.version
                dirtyRef.current = true
                pullCompletedRef.current = true
                return pushToCloud()
              }
              globalTimestamps = { lastPullAt: Date.now(), cloudUpdatedAt: res.updatedAt }
              notifyTimestamps()
            },
          }
          notifySync({ type: 'pull_conflict' })
        }
        return // Don't overwrite silently — wait for user decision
      }

      // ── No conflict: write cloud data into localStorage stores ──
      pullCompletedRef.current = true
      _skipPushRef.current = true
      writeCloudToLocalStorage(raw)
      // Reset after all synchronous store subscription callbacks have fired
      Promise.resolve().then(() => { _skipPushRef.current = false })
      _cloudVersion = res.version
      setLastSyncSignature(computeSyncSignature(raw))
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
    if (!getTokens().accessToken || !dirtyRef.current) return
    // If the first pull hasn't completed yet, re-schedule the push
    // so dirty data isn't silently dropped. The debounce timer will
    // keep retrying until pullCompletedRef becomes true.
    if (!pullCompletedRef.current) {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
      pushTimerRef.current = setTimeout(() => pushToCloud(), PUSH_DEBOUNCE_MS)
      return
    }
    dirtyRef.current = false
    try {
      const localData = collectSyncData()
      const res = await postSyncDataApi({
        base_version: _cloudVersion,
        data: {
          schemaVersion: 2,
          capturedAt: new Date().toISOString(),
          ...localData,
        },
      }, 'auto')
      _cloudVersion = res.version
      setLastSyncSignature(computeSyncSignature(localData))
      if (useEssenceSettingsStore.getState().notifyOnSync) notifySync({ type: 'push_success' })
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
          const pushInfo: SyncConflictInfo = {
            type: 'push_conflict',
            localSummary: localRows,
            cloudSummary: cloudRows,
            settingsDiff: settingsDiff.length > 0 ? settingsDiff : undefined,
            cloudVersion: latest.version,
            cloudUpdatedAt: latest.updatedAt,
            resolve: (choice) => {
              _conflictPendingRef.current = false
              if (choice === 'cloud' && cloudRaw) {
                _skipPushRef.current = true
                writeCloudToLocalStorage(cloudRaw)
                Promise.resolve().then(() => { _skipPushRef.current = false })
                _cloudVersion = latest.version
                setLastSyncSignature(computeSyncSignature(cloudRaw))
                pullCompletedRef.current = true
              }
              if (choice === 'local') {
                pullCompletedRef.current = true
                _skipPushRef.current = true
                _cloudVersion = latest.version
                dirtyRef.current = true
                return getSyncDataApi().then(latestNow => {
                  _cloudVersion = latestNow.version
                  _skipPushRef.current = false
                  dirtyRef.current = true
                  return pushToCloud()
                }).catch(() => {
                  _skipPushRef.current = false
                  dirtyRef.current = true
                  return pushToCloud()
                })
              } else {
                _cloudVersion = latest.version
              }
              globalTimestamps = { lastPullAt: Date.now(), cloudUpdatedAt: latest.updatedAt }
              notifyTimestamps()
            },
          }
          if (_conflictCallback) {
            _conflictPendingRef.current = true
            _conflictCallback(pushInfo)
          } else {
            _pendingConflict = pushInfo
            notifySync({ type: 'push_conflict' })
          }
        } catch {
          notifySync({ type: 'sync_error' })
        }
      }
      // For non-version-conflict errors (e.g. custom_weapons_not_allowed on free tier),
      // notify the user via the global toast so they know something went wrong.
      if (err instanceof Error && err.message !== 'version_conflict') {
        notifySync({ type: 'sync_error', message: err.message })
      }
    }
  }, []) // stable — reads token from localStorage at call time

  // ── Debounced push trigger ─────────────────────────────
  const schedulePush = useCallback(() => {
    if (_skipPushRef.current) return
    // Block auto-push while a conflict dialog is open — prevents
    // auto-sync from bypassing an unresolved conflict.
    if (_conflictPendingRef.current) return
    // Check auto-sync permission at execution time so state changes
    // that happened before the subscriptions were set up (e.g. auth
    // rehydration) are still honoured.
    if (!shouldAutoSync()) return
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
    }

    // Always register the visibility listener — check auto-sync permission
    // inside the callback so it still works when auth rehydration completes
    // after the listener has been set up.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!shouldAutoSync()) return
      pullFromCloud()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (pullTimerRef.current) clearInterval(pullTimerRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [accessToken, hasAutoSync, autoSyncEnabled]) // pullFromCloud is stable (useCallback with [])

  // ── Watch stores for changes ────────────────────────────────────
  // Always subscribe; the schedulePush callback checks shouldAutoSync()
  // at execution time, so subscriptions are harmless when auto-sync is
  // disabled and will start working as soon as it becomes enabled.
  useEffect(() => {
    const unsubs: (() => void)[] = []

    // Subscribe to each store — Zustand's subscribe fires on every state change
    // Subscribe only to sync-relevant state changes so computed/UI-only fields
    // (plansMap, planOrder, plansStale, searchQuery, notifyOnSync, etc.) do not
    // trigger spurious auto-pushes.
    unsubs.push(
      useMatrixStore.subscribe((state, prevState) => {
        if (
          state.selectedWeaponIds !== prevState.selectedWeaponIds ||
          state.dungeonS1Selections !== prevState.dungeonS1Selections ||
          state.expandedPlanKeys !== prevState.expandedPlanKeys ||
          state.selectedRegions !== prevState.selectedRegions ||
          state.selectedSubRegions !== prevState.selectedSubRegions
        ) {
          schedulePush()
        }
      }),
    )
    unsubs.push(
      useRefinementStore.subscribe((state, prevState) => {
        if (
          state.selectedEquipId !== prevState.selectedEquipId ||
          state.collapsedSets !== prevState.collapsedSets ||
          state.filterCollapsed !== prevState.filterCollapsed
        ) {
          schedulePush()
        }
      }),
    )
    unsubs.push(
      useEssenceSettingsStore.subscribe((state, prevState) => {
        if (
          state.weaponOwnership !== prevState.weaponOwnership ||
          state.essenceStatus !== prevState.essenceStatus ||
          state.weaponNotes !== prevState.weaponNotes ||
          state.customWeapons !== prevState.customWeapons ||
          state.regionFirst !== prevState.regionFirst ||
          state.regionSecond !== prevState.regionSecond ||
          state.hideEssenceOwnedWeaponsList !== prevState.hideEssenceOwnedWeaponsList ||
          state.hideEssenceOwnedWeaponsPlans !== prevState.hideEssenceOwnedWeaponsPlans ||
          state.hideUnownedWeaponsList !== prevState.hideUnownedWeaponsList ||
          state.hideUnownedWeaponsPlans !== prevState.hideUnownedWeaponsPlans ||
          state.hideFourStarWeaponsList !== prevState.hideFourStarWeaponsList ||
          state.hideFourStarWeaponsPlans !== prevState.hideFourStarWeaponsPlans ||
          state.enableOwnershipEditList !== prevState.enableOwnershipEditList ||
          state.enableOwnershipEditPlans !== prevState.enableOwnershipEditPlans ||
          state.enableNotesList !== prevState.enableNotesList ||
          state.enableNotesPlans !== prevState.enableNotesPlans ||
          state.keepUpVisibleList !== prevState.keepUpVisibleList ||
          state.keepUpVisiblePlans !== prevState.keepUpVisiblePlans ||
          state.onlyHideWhenBothOwned !== prevState.onlyHideWhenBothOwned
        ) {
          schedulePush()
        }
      }),
    )

    return () => { for (const u of unsubs) u() }
    // Subscribe once on mount — shouldAutoSync() inside schedulePush
    // handles the dynamic condition check at execution time.
  }, [])

  // ── Cleanup on unmount ─────────────────────────────────
  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
      if (pullTimerRef.current) clearInterval(pullTimerRef.current)
    }
  }, [])

  return { pullFromCloud, pushToCloud }
}
