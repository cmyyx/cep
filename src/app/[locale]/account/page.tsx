'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Cloud, HardDrive, AlertTriangle, CheckCircle2, Mail, Shield, RefreshCw, LogOut, Crown, Key, Send, Zap, Monitor, X, Eye, EyeOff, Gift } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/stores/useAuthStore'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { getSyncDataApi, postSyncDataApi, api, ApiError, getErrorI18nKey, type SyncDataResponse } from '@/lib/api'
import { getSyncTimestamps, subscribeSyncTimestamps, setAutoSyncConflictCallback, syncStoresFromCloudPayload, hasExistingLocalData, syncDataDiffers, buildSummaryRows, buildSettingsDiff, updateLastPull, getCloudVersion, updateCloudVersion, setSkipNextPush, computeSyncSignature, getLastSyncSignature, setLastSyncSignature, getPendingConflict, clearPendingConflict, dismissConflictToast, notifySync, setConflictPending, getLastPullResult, type SyncConflictInfo } from '@/hooks/useAutoSync'
import { cn, maskEmail, isValidEmail, formatTime } from '@/lib/utils'
import { SyncConflictDialog } from '@/components/shared/sync-conflict-dialog'
import { equipById } from '@/data/equips'
import { redeemCodeApi } from '@/lib/api'
import { resolveWeaponId, resolveWeaponIdKeys, resolveS1Selections } from '@/lib/resolve-weapon-id'

// ─── Sync ────────────────────────────────────────────────────

/** Resolve stale preview:* weapon IDs in a cloud sync payload in-place.
 *  Mutates the raw object so all downstream inline localStorage writes
 *  and store updates automatically use resolved game IDs. */
function resolveCloudWeaponIds(raw: Record<string, unknown>): void {
  try {
    const ep = raw.essencePlanner as Record<string, unknown> | undefined
    if (ep) {
      if (Array.isArray(ep.selectedWeaponIds)) {
        ep.selectedWeaponIds = (ep.selectedWeaponIds as string[]).map(resolveWeaponId)
      }
      if (ep.dungeonS1Selections) {
        ep.dungeonS1Selections = resolveS1Selections(ep.dungeonS1Selections as Record<string, string[]>)
      }
    }
  } catch { /* best-effort */ }
  try {
    const es = raw.essenceSettings as Record<string, unknown> | undefined
    if (es) {
      if (es.weaponOwnership) es.weaponOwnership = resolveWeaponIdKeys(es.weaponOwnership as Record<string, unknown>)
      if (es.essenceStatus) es.essenceStatus = resolveWeaponIdKeys(es.essenceStatus as Record<string, unknown>)
      if (es.weaponNotes) es.weaponNotes = resolveWeaponIdKeys(es.weaponNotes as Record<string, unknown>)
    }
  } catch { /* best-effort */ }
}

/** Module-level cache for collectLocalData to avoid redundant
 *  localStorage parsing when called multiple times in quick succession
 *  (e.g., during conflict resolution in handlePush). TTL is short enough
 *  that it won't serve stale data across user interactions. */
let _cachedLocalData: { data: Record<string, unknown>; ts: number } | null = null
const LOCAL_DATA_CACHE_TTL_MS = 100

/** Map a caught error to the appropriate i18n key. */
function getSyncErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    return getErrorI18nKey(err.message) ?? 'account.fetchSyncFailed'
  }
  return 'account.syncFailed'
}

/** Format a sync row cell value — for equip IDs, translate via equipById + i18n. */
function formatSyncCellVal(key: string, val: string | number, t: ReturnType<typeof useTranslations>): string {
  if (key === 'syncRefinementSelection') {
    const id = String(val)
    if (!id || id === '0') return '—'
    const equip = equipById.get(id)
    return equip ? (t(`equips.${equip.id}`) ?? equip.name) : id
  }
  if (val === 0 || val === '') return '—'
  return String(val)
}

function buildSyncRows(local: Record<string, unknown>, cloud: Record<string, unknown> | null) {
  const le = (local.essencePlanner ?? {}) as Record<string, unknown>
  const ls = (local.essenceSettings ?? {}) as Record<string, unknown>
  const lr = (local.refinementPlanner ?? {}) as Record<string, unknown>
  const ce = cloud ? ((cloud.essencePlanner ?? {}) as Record<string, unknown>) : null
  const cs = cloud ? ((cloud.essenceSettings ?? {}) as Record<string, unknown>) : null
  const cr = cloud ? ((cloud.refinementPlanner ?? {}) as Record<string, unknown>) : null
  return [
    { k: 'syncPlannedWeapons', label: 'account.syncPlannedWeapons', l: Array.isArray(le.selectedWeaponIds) ? le.selectedWeaponIds.length : 0, c: ce && Array.isArray(ce.selectedWeaponIds) ? ce.selectedWeaponIds.length : 0 },
    { k: 'syncRefinementSelection', label: 'account.syncRefinementSelection', l: (lr.selectedEquipId as string) || '0', c: (cr?.selectedEquipId as string) || '0' },
    { k: 'syncWeaponOwnership', label: 'account.syncWeaponOwnership', l: Object.keys((ls.weaponOwnership ?? {}) as object).length, c: cs ? Object.keys((cs.weaponOwnership ?? {}) as object).length : 0 },
    { k: 'syncEssenceStatus', label: 'account.syncEssenceStatus', l: Object.keys((ls.essenceStatus ?? {}) as object).length, c: cs ? Object.keys((cs.essenceStatus ?? {}) as object).length : 0 },
    { k: 'syncCustomWeapons', label: 'account.syncCustomWeapons', l: Array.isArray(ls.customWeapons) ? ls.customWeapons.length : 0, c: cs && Array.isArray(cs.customWeapons) ? cs.customWeapons.length : 0 },
    { k: 'syncWeaponNotes', label: 'account.syncWeaponNotes', l: Object.keys((ls.weaponNotes ?? {}) as object).length, c: cs ? Object.keys((cs.weaponNotes ?? {}) as object).length : 0 },
  ]
}

function collectLocalData(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  // Return cached result if within TTL — deduplicates rapid-fire calls
  const now = Date.now()
  if (_cachedLocalData && (now - _cachedLocalData.ts) < LOCAL_DATA_CACHE_TTL_MS) {
    return _cachedLocalData.data
  }
  const data: Record<string, unknown> = {}
  try { const r = localStorage.getItem('matrix-session'); if (r) { const p = JSON.parse(r); const s = p?.state ?? p; const ids: string[] = Array.isArray(s.selectedWeaponIds) ? s.selectedWeaponIds : []; data.essencePlanner = { selectedWeaponIds: ids.map(resolveWeaponId), dungeonS1Selections: resolveS1Selections((s.dungeonS1Selections ?? {}) as Record<string, string[]>) } } } catch {}
  try { const r = localStorage.getItem('essence-settings'); if (r) { const p = JSON.parse(r); const s = p?.state ?? p; data.essenceSettings = { weaponOwnership: resolveWeaponIdKeys((s.weaponOwnership ?? {}) as Record<string, unknown>), essenceStatus: resolveWeaponIdKeys((s.essenceStatus ?? {}) as Record<string, unknown>), weaponNotes: resolveWeaponIdKeys((s.weaponNotes ?? {}) as Record<string, unknown>), customWeapons: s.customWeapons ?? [], flags: Object.fromEntries(['hideEssenceOwnedWeaponsList','hideEssenceOwnedWeaponsPlans','hideUnownedWeaponsList','hideUnownedWeaponsPlans','hideFourStarWeaponsList','hideFourStarWeaponsPlans','enableOwnershipEditList','enableOwnershipEditPlans','enableNotesList','enableNotesPlans','keepUpVisibleList','keepUpVisiblePlans','onlyHideWhenBothOwned'].map(k=>[k,s[k]??false])), regionFirst: s.regionFirst??null, regionSecond: s.regionSecond??null } } } catch {}
  try { const r = localStorage.getItem('refinement-session'); if (r) { const p = JSON.parse(r); const s = p?.state ?? p; data.refinementPlanner = { selectedEquipId: s.selectedEquipId ?? null } } } catch {}
  _cachedLocalData = { data, ts: Date.now() }
  return data
}

// ─── Page ────────────────────────────────────────────────────

export default function AccountPage() {
  const t = useTranslations(); const locale = useLocale(); const router = useRouter()

  const username = useAuthStore(s => s.username)
  const email = useAuthStore(s => s.email)
  const emailVerified = useAuthStore(s => s.emailVerified)
  const premiumUntilStr = useAuthStore(s => s.premiumUntil)
  const premiumPreGrantedStr = useAuthStore(s => s.premiumPreGrantedUntil)
  const premiumTrialStr = useAuthStore(s => s.premiumTrialUntil)
  const logout = useAuthStore(s => s.logout)
  const accessToken = useAuthStore(s => s.accessToken)
  const fetchMeGlobal = useAuthStore(s => s.fetchMe)
  const paymentClaims = useAuthStore(s => s.paymentClaims)
  const autoSyncEnabled = useEssenceSettingsStore(s => s.autoSyncEnabled)
  const setAutoSyncEnabled = useEssenceSettingsStore(s => s.setAutoSyncEnabled)
  const notifyOnSync = useEssenceSettingsStore(s => s.notifyOnSync)
  const setNotifyOnSync = useEssenceSettingsStore(s => s.setNotifyOnSync)
  const notifyOnPull = useEssenceSettingsStore(s => s.notifyOnPull)
  const setNotifyOnPull = useEssenceSettingsStore(s => s.setNotifyOnPull)

  // Hydration guard: ensure server & client render the same initial tree
  const [mounted, setMounted] = useState(false)

  // Sync
  const [cloudData, setCloudData] = useState<SyncDataResponse | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle'|'loading'|'pushing'|'error'|'success'>('idle')
  const [syncError, setSyncError] = useState<string|null>(null)
  const [cloudVersion, setCloudVersion] = useState<number|null>(null)

  // Change email / password
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [newEmail, setNewEmail] = useState(''); const [changeEmailSent, setChangeEmailSent] = useState(false)
  const [changeEmailCode, setChangeEmailCode] = useState('')
  const [changeEmailCodeSubmitting, setChangeEmailCodeSubmitting] = useState(false)
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [currentPwd, setCurrentPwd] = useState(''); const [newPwd, setNewPwd] = useState(''); const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdError, setPwdError] = useState<string|null>(null)

  // Email verify
  const [verifySending, setVerifySending] = useState(false)
  const [verifySent, setVerifySent] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifySubmitting, setVerifySubmitting] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [emailChanging, setEmailChanging] = useState(false)
  const [showFullEmail, setShowFullEmail] = useState(false)
  const [passwordChanging, setPasswordChanging] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [revokingIds, setRevokingIds] = useState<Set<number>>(new Set())

  // Sessions
  const sessions = useAuthStore(s => s.sessions)
  const sessionsLoading = useAuthStore(s => s.sessionsLoading)
  const revokeSession = useAuthStore(s => s.revokeSession)

  // Payment
  const [showClaimForm, setShowClaimForm] = useState(false); const [claimChannel, setClaimChannel] = useState('alipay')
  const [claimPlanType, setClaimPlanType] = useState('monthly'); const [claimQuantity, setClaimQuantity] = useState(1)
  const [claimRef, setClaimRef] = useState(''); const [claimMerchant, setClaimMerchant] = useState(''); const [claimPaidTime, setClaimPaidTime] = useState('')
  const [claimSubmitting, setClaimSubmitting] = useState(false); const [claimError, setClaimError] = useState<string|null>(null); const [claimSuccess, setClaimSuccess] = useState(false); const [claimPreGranted, setClaimPreGranted] = useState(false)

  // Redeem
  const [redeemCode, setRedeemCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [redeemResult, setRedeemResult] = useState<{ days: number; until: string } | null>(null)
  const redeemHistory = useAuthStore(s => s.redeemHistory)

  // Tier
  const premiumUntil = premiumUntilStr ? new Date(premiumUntilStr).getTime() : 0
  const premiumPreGrantedUntil = premiumPreGrantedStr ? new Date(premiumPreGrantedStr).getTime() : 0

  // Tab state
  const [accountTab, setAccountTab] = useState<'account' | 'membership'>('account')
  const trialUntil = premiumTrialStr ? new Date(premiumTrialStr).getTime() : 0
  // eslint-disable-next-line react-hooks/purity -- reading current time for tier expiry check
  const now = Date.now()
  const isTrial = !!(trialUntil > now && premiumUntil <= now && premiumPreGrantedUntil <= now)
  const isPremium = !!(premiumUntil > now || premiumPreGrantedUntil > now)
  // True when premium comes ONLY from pre-grant (pending review), not from approved premium_until
  const isPreGrantedOnly = !!(premiumPreGrantedUntil > now && premiumUntil <= now && trialUntil <= now)
  const displayTier: 'free'|'trial'|'premium' = isPremium ? 'premium' : isTrial ? 'trial' : 'free'
  const planExpireDate = premiumUntil > now ? premiumUntilStr : premiumPreGrantedUntil > now ? premiumPreGrantedStr : isTrial ? premiumTrialStr : null
  const hasAutoSync = isPremium || isTrial

  // Sync conflict handling: auto-pull/push may detect conflicts and show dialog
  const [conflict, setConflict] = useState<SyncConflictInfo | null>(null)

  const fetchCloud = useCallback(async () => {
    if (!accessToken) return; setSyncStatus('loading'); setSyncError(null)
    try { const res = await getSyncDataApi(); setCloudData(res); setCloudVersion(res.version); updateCloudVersion(res.version); setSyncStatus('success'); updateLastPull(res.updatedAt) }
    catch (err) { setSyncStatus('error'); setSyncError(getSyncErrorKey(err)) }
  }, [accessToken])

  // Pull from cloud with conflict detection (called by "从云端下载" button)
  const handlePull = useCallback(async () => {
    if (!accessToken) return
    setSyncStatus('loading'); setSyncError(null)
    try {
      const res = await getSyncDataApi()
      const raw = res.data as Record<string, unknown> | null
      if (raw) {
        resolveCloudWeaponIds(raw)
        const localData = collectLocalData()
        if (hasExistingLocalData(localData) && syncDataDiffers(localData, raw)) {
          // If local hasn't changed since last sync, auto-apply cloud silently
          const lastSig = getLastSyncSignature()
          if (lastSig !== null && computeSyncSignature(localData) === lastSig) {
            setSkipNextPush(true)
            const r = raw
            try { const ep = r.essencePlanner as Record<string, unknown> | undefined; if (ep) { const current = JSON.parse(localStorage.getItem('matrix-session') || '{}'); const s = current?.state ?? current; if (Array.isArray(ep.selectedWeaponIds)) s.selectedWeaponIds = ep.selectedWeaponIds; if (ep.dungeonS1Selections) s.dungeonS1Selections = ep.dungeonS1Selections; localStorage.setItem('matrix-session', JSON.stringify({ ...current, state: s })) } } catch {}
            try { const es = r.essenceSettings as Record<string, unknown> | undefined; if (es) { const current = JSON.parse(localStorage.getItem('essence-settings') || '{}'); const s = current?.state ?? current; if (es.weaponOwnership) s.weaponOwnership = es.weaponOwnership; if (es.essenceStatus) s.essenceStatus = es.essenceStatus; if (es.weaponNotes) s.weaponNotes = es.weaponNotes; if (Array.isArray(es.customWeapons)) s.customWeapons = es.customWeapons; if (es.flags) Object.assign(s, es.flags); if (es.regionFirst !== undefined) s.regionFirst = es.regionFirst; if (es.regionSecond !== undefined) s.regionSecond = es.regionSecond; localStorage.setItem('essence-settings', JSON.stringify({ ...current, state: s })) } } catch {}
            try { const rp = r.refinementPlanner as Record<string, unknown> | undefined; if (rp) { const current = JSON.parse(localStorage.getItem('refinement-session') || '{}'); const s = current?.state ?? current; if (rp.selectedEquipId !== undefined) s.selectedEquipId = rp.selectedEquipId; localStorage.setItem('refinement-session', JSON.stringify({ ...current, state: s })) } } catch {}
            syncStoresFromCloudPayload(r)
            setSkipNextPush(false)
            setCloudVersion(res.version)
            updateCloudVersion(res.version)
            setLastSyncSignature(computeSyncSignature(raw))
            setCloudData(res); setSyncStatus('success'); updateLastPull(res.updatedAt)
            return
          }
          // If cloud hasn't changed since last sync but local has —
          // user explicitly clicked "download", so apply cloud to local
          // without prompting (same as path A, just a different sig check).
          if (lastSig !== null && computeSyncSignature(raw) === lastSig) {
            setSkipNextPush(true)
            const r = raw
            try { const ep = r.essencePlanner as Record<string, unknown> | undefined; if (ep) { const current = JSON.parse(localStorage.getItem('matrix-session') || '{}'); const s = current?.state ?? current; if (Array.isArray(ep.selectedWeaponIds)) s.selectedWeaponIds = ep.selectedWeaponIds; if (ep.dungeonS1Selections) s.dungeonS1Selections = ep.dungeonS1Selections; localStorage.setItem('matrix-session', JSON.stringify({ ...current, state: s })) } } catch {}
            try { const es = r.essenceSettings as Record<string, unknown> | undefined; if (es) { const current = JSON.parse(localStorage.getItem('essence-settings') || '{}'); const s = current?.state ?? current; if (es.weaponOwnership) s.weaponOwnership = es.weaponOwnership; if (es.essenceStatus) s.essenceStatus = es.essenceStatus; if (es.weaponNotes) s.weaponNotes = es.weaponNotes; if (Array.isArray(es.customWeapons)) s.customWeapons = es.customWeapons; if (es.flags) Object.assign(s, es.flags); if (es.regionFirst !== undefined) s.regionFirst = es.regionFirst; if (es.regionSecond !== undefined) s.regionSecond = es.regionSecond; localStorage.setItem('essence-settings', JSON.stringify({ ...current, state: s })) } } catch {}
            try { const rp = r.refinementPlanner as Record<string, unknown> | undefined; if (rp) { const current = JSON.parse(localStorage.getItem('refinement-session') || '{}'); const s = current?.state ?? current; if (rp.selectedEquipId !== undefined) s.selectedEquipId = rp.selectedEquipId; localStorage.setItem('refinement-session', JSON.stringify({ ...current, state: s })) } } catch {}
            syncStoresFromCloudPayload(r)
            setSkipNextPush(false)
            setCloudVersion(res.version)
            updateCloudVersion(res.version)
            setLastSyncSignature(computeSyncSignature(raw))
            setCloudData(res); setSyncStatus('success'); updateLastPull(res.updatedAt)
            return
          }
          // Conflict: show dialog, don't apply
          const localRows = buildSummaryRows(localData)
          const cloudRows = buildSummaryRows(raw)
          const settingsDiff = buildSettingsDiff(localData, raw)
          setConflictPending(true)
          setConflict({
            type: 'pull_conflict',
            localSummary: localRows,
            cloudSummary: cloudRows,
            settingsDiff: settingsDiff.length > 0 ? settingsDiff : undefined,
            cloudVersion: res.version,
            cloudUpdatedAt: res.updatedAt,
            resolve: (choice) => {
              if (choice === 'cloud') {
                // Write cloud to localStorage + sync stores
                setSkipNextPush(true)
                const r = raw
                try {
                  const ep = r.essencePlanner as Record<string, unknown> | undefined
                  if (ep) {
                    const current = JSON.parse(localStorage.getItem('matrix-session') || '{}')
                    const s = current?.state ?? current
                    if (Array.isArray(ep.selectedWeaponIds)) s.selectedWeaponIds = ep.selectedWeaponIds
                    if (ep.dungeonS1Selections) s.dungeonS1Selections = ep.dungeonS1Selections
                    localStorage.setItem('matrix-session', JSON.stringify({ ...current, state: s }))
                  }
                } catch {}
                try {
                  const es = r.essenceSettings as Record<string, unknown> | undefined
                  if (es) {
                    const current = JSON.parse(localStorage.getItem('essence-settings') || '{}')
                    const s = current?.state ?? current
                    if (es.weaponOwnership) s.weaponOwnership = es.weaponOwnership
                    if (es.essenceStatus) s.essenceStatus = es.essenceStatus
                    if (es.weaponNotes) s.weaponNotes = es.weaponNotes
                    if (Array.isArray(es.customWeapons)) s.customWeapons = es.customWeapons
                    if (es.flags) Object.assign(s, es.flags)
                    if (es.regionFirst !== undefined) s.regionFirst = es.regionFirst
                    if (es.regionSecond !== undefined) s.regionSecond = es.regionSecond
                    localStorage.setItem('essence-settings', JSON.stringify({ ...current, state: s }))
                  }
                } catch {}
                try {
                  const rp = r.refinementPlanner as Record<string, unknown> | undefined
                  if (rp) {
                    const current = JSON.parse(localStorage.getItem('refinement-session') || '{}')
                    const s = current?.state ?? current
                    if (rp.selectedEquipId !== undefined) s.selectedEquipId = rp.selectedEquipId
                    localStorage.setItem('refinement-session', JSON.stringify({ ...current, state: s }))
                  }
                } catch {}
                syncStoresFromCloudPayload(raw)
                setSkipNextPush(false)
                setCloudVersion(res.version)
                updateCloudVersion(res.version)
                setLastSyncSignature(computeSyncSignature(raw))
                setCloudData(res); setSyncStatus('success'); updateLastPull(res.updatedAt)
                setConflictPending(false)
                setConflict(null)
              }
              if (choice === 'local') {
                // Push local to cloud, refresh only after POST completes
                const localData = collectLocalData()
                setSyncStatus('pushing')
                postSyncDataApi({
                  base_version: getCloudVersion() || res.version,
                  data: { schemaVersion: 2, capturedAt: new Date().toISOString(), ...localData },
                }, 'manual').then(pushRes => {
                  setCloudVersion(pushRes.version)
                  updateCloudVersion(pushRes.version)
                  setLastSyncSignature(computeSyncSignature(localData))
                  return fetchCloud()
                }).then(() => {
                  setConflictPending(false)
                  setConflict(null)
                  setSyncStatus('success')
                }).catch((err) => {
                  // Keep conflict visible — do NOT clear conflict state.
                  // Do NOT call fetchCloud() here; a successful GET would
                  // mask the failed POST.
                  setSyncStatus('error')
                  setSyncError(getSyncErrorKey(err))
                })
              }
            },
          })
          setSyncStatus('success')
        } else {
          // No conflict: apply directly (only if data actually differs)
          const dataChanged = !hasExistingLocalData(localData) || syncDataDiffers(localData, raw)
          if (dataChanged) {
          const r = raw
          try {
            const ep = r.essencePlanner as Record<string, unknown> | undefined
            if (ep) {
              const current = JSON.parse(localStorage.getItem('matrix-session') || '{}')
              const s = current?.state ?? current
              if (Array.isArray(ep.selectedWeaponIds)) s.selectedWeaponIds = ep.selectedWeaponIds
              if (ep.dungeonS1Selections) s.dungeonS1Selections = ep.dungeonS1Selections
              localStorage.setItem('matrix-session', JSON.stringify({ ...current, state: s }))
            }
          } catch {}
          try {
            const es = r.essenceSettings as Record<string, unknown> | undefined
            if (es) {
              const current = JSON.parse(localStorage.getItem('essence-settings') || '{}')
              const s = current?.state ?? current
              if (es.weaponOwnership) s.weaponOwnership = es.weaponOwnership
              if (es.essenceStatus) s.essenceStatus = es.essenceStatus
              if (es.weaponNotes) s.weaponNotes = es.weaponNotes
              if (Array.isArray(es.customWeapons)) s.customWeapons = es.customWeapons
              if (es.flags) Object.assign(s, es.flags)
              if (es.regionFirst !== undefined) s.regionFirst = es.regionFirst
              if (es.regionSecond !== undefined) s.regionSecond = es.regionSecond
              localStorage.setItem('essence-settings', JSON.stringify({ ...current, state: s }))
            }
          } catch {}
          try {
            const rp = r.refinementPlanner as Record<string, unknown> | undefined
            if (rp) {
              const current = JSON.parse(localStorage.getItem('refinement-session') || '{}')
              const s = current?.state ?? current
              if (rp.selectedEquipId !== undefined) s.selectedEquipId = rp.selectedEquipId
              localStorage.setItem('refinement-session', JSON.stringify({ ...current, state: s }))
            }
          } catch {}
          syncStoresFromCloudPayload(r)
          }
          setCloudData(res); setCloudVersion(res.version); updateCloudVersion(res.version); setSyncStatus('success'); updateLastPull(res.updatedAt)
        }
      } else {
        setCloudData(res); setCloudVersion(res.version); updateCloudVersion(res.version); setSyncStatus('success'); updateLastPull(res.updatedAt)
      }
    } catch (err) {
      setSyncStatus('error'); setSyncError(getSyncErrorKey(err))
    }
  }, [accessToken, fetchCloud])

  // Mark component as mounted (client-only, prevents hydration mismatch)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard hydration guard pattern
  useEffect(() => { setMounted(true) }, [])

  // Load data once on mount: /me + cloud sync data for display.
  // Reuses the pull already done by useAutoSync to avoid a duplicate GET.
  const initialLoadDone = useRef(false)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- initial data load, not cascading renders */
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    if (accessToken) {
      fetchMeGlobal()
      const cached = getLastPullResult()
      if (cached && cached.version > 0) {
        setCloudData(cached)
        setCloudVersion(cached.version)
        updateCloudVersion(cached.version)
        updateLastPull(cached.updatedAt ?? null)
        setSyncStatus('success')
      } else {
        // Auto-sync hasn't pulled yet — do our own
        fetchCloud()
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyCloudDataToLocal = (cloudRaw: Record<string, unknown>) => {
    // Resolve stale preview: IDs before writing to localStorage.
    resolveCloudWeaponIds(cloudRaw)
    try {
      const ep = cloudRaw.essencePlanner as Record<string, unknown> | undefined
      if (ep) {
        const current = JSON.parse(localStorage.getItem('matrix-session') || '{}')
        const state = current?.state ?? current
        if (Array.isArray(ep.selectedWeaponIds)) state.selectedWeaponIds = ep.selectedWeaponIds
        if (ep.dungeonS1Selections) state.dungeonS1Selections = ep.dungeonS1Selections
        localStorage.setItem('matrix-session', JSON.stringify({ ...current, state }))
      }
    } catch {}
    try {
      const es = cloudRaw.essenceSettings as Record<string, unknown> | undefined
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
    } catch {}
    try {
      const rp = cloudRaw.refinementPlanner as Record<string, unknown> | undefined
      if (rp) {
        const current = JSON.parse(localStorage.getItem('refinement-session') || '{}')
        const state = current?.state ?? current
        if (rp.selectedEquipId !== undefined) state.selectedEquipId = rp.selectedEquipId
        localStorage.setItem('refinement-session', JSON.stringify({ ...current, state }))
      }
    } catch {}
  }

  const handlePushConflict = async () => {
    try {
      const latest = await getSyncDataApi()
      const localData = collectLocalData()
      const cloudRaw = latest.data as Record<string, unknown> | null
      if (cloudRaw) resolveCloudWeaponIds(cloudRaw)
      const localRows = buildSummaryRows(localData)
      const cloudRows = cloudRaw
        ? buildSummaryRows(cloudRaw)
        : { weapons: '0', equip: '', ownership: '0', essence: '0', customWeapons: '0', weaponNotes: '0' }
      const settingsDiff = cloudRaw ? buildSettingsDiff(localData, cloudRaw) : []

      setSyncStatus('success')
      setConflictPending(true)
      setConflict({
        type: 'push_conflict',
        localSummary: localRows,
        cloudSummary: cloudRows,
        settingsDiff: settingsDiff.length > 0 ? settingsDiff : undefined,
        cloudVersion: latest.version,
        cloudUpdatedAt: latest.updatedAt,
        resolve: (choice) => {
          if (choice === 'cloud') {
            setSkipNextPush(true)
            // cloudRaw may be null (empty cloud snapshot) — treat as valid
            const raw = cloudRaw ?? {} as Record<string, unknown>
            applyCloudDataToLocal(raw)
            setCloudVersion(latest.version)
            updateCloudVersion(latest.version)
            syncStoresFromCloudPayload(raw)
            setSkipNextPush(false)
            setLastSyncSignature(computeSyncSignature(raw))
            fetchCloud().then(() => {
              setConflictPending(false)
              setConflict(null)
            })
          }
          if (choice === 'local') {
            setCloudVersion(latest.version)
            updateCloudVersion(latest.version)
            setSyncStatus('pushing')
            const ld = collectLocalData()
            postSyncDataApi(
              { base_version: latest.version, data: { schemaVersion: 2, capturedAt: new Date().toISOString(), ...ld } },
              'manual',
            )
              .then((pushRes) => {
                setCloudVersion(pushRes.version)
                updateCloudVersion(pushRes.version)
                setLastSyncSignature(computeSyncSignature(ld))
                return fetchCloud()
              })
              .then(() => {
                setConflictPending(false)
                setConflict(null)
                setSyncStatus('success')
              })
              .catch((err) => {
                // Keep conflict visible — do NOT clear conflict state.
                // Do NOT call fetchCloud() here; a successful GET would
                // mask the failed POST and make it appear the local merge succeeded.
                setSyncStatus('error')
                setSyncError(getSyncErrorKey(err))
              })
          }
        },
      })
    } catch (err) {
      setSyncStatus('error')
      setSyncError(getSyncErrorKey(err))
    }
  }

  const handlePush = async () => {
    setSyncStatus('pushing')
    setSyncError(null)
    try {
      const localData = collectLocalData()
      const res = await postSyncDataApi({
        base_version: getCloudVersion(),
        data: { schemaVersion: 2, capturedAt: new Date().toISOString(), ...localData },
      })
      setCloudVersion(res.version)
      updateCloudVersion(res.version)
      setLastSyncSignature(computeSyncSignature(localData))
      setCloudData({ data: res.data, version: res.version, updatedAt: res.updatedAt ?? null })
      if (res.unchanged) {
        setSyncStatus('success')
        notifySync({ type: 'push_unchanged' })
      } else {
        setSyncStatus('success')
        updateLastPull(res.updatedAt ?? null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'version_conflict') {
        await handlePushConflict()
      } else {
        setSyncStatus('error')
        setSyncError(getSyncErrorKey(err))
      }
    }
  }
  const handleVerifyEmail = async () => { setVerifySending(true); setVerifyError(null); try { await api('/api/email/send-verification',{method:'POST'}); setVerifySent(true) } catch (err) { setVerifyError(err instanceof Error ? err.message : 'send_failed') } finally { setVerifySending(false) } }
  const handleSubmitVerificationCode = async () => { if(!verifyCode)return; setVerifySubmitting(true); setVerifyError(null); try { await api('/api/email/verify',{method:'POST',body:{code:verifyCode}}); await fetchMeGlobal(); setVerifySent(false); setVerifyCode('') } catch (err) { setVerifyError(err instanceof Error ? err.message : 'invalid_code') } finally { setVerifySubmitting(false) } }
  const handleChangeEmail = async () => { if(!newEmail)return; if(!isValidEmail(newEmail)){setChangeEmailError('invalidEmail');return}; setEmailChanging(true); setChangeEmailError(null); try { await api('/api/email/request-change',{method:'POST',body:{newEmail}}); await fetchMeGlobal(); setChangeEmailSent(true) } catch (err) { setChangeEmailError(err instanceof Error ? err.message : 'send_failed') } finally { setEmailChanging(false) } }
  const handleSubmitChangeEmailCode = async () => { if(!changeEmailCode)return; setChangeEmailCodeSubmitting(true); setChangeEmailError(null); try { await api('/api/email/verify',{method:'POST',body:{code:changeEmailCode}}); await fetchMeGlobal(); setShowChangeEmail(false); setChangeEmailSent(false); setChangeEmailCode(''); setNewEmail('') } catch (err) { setChangeEmailError(err instanceof Error ? err.message : 'invalid_code') } finally { setChangeEmailCodeSubmitting(false) } }
  const handleChangePassword = async () => { setPwdError(null); if(!currentPwd||!newPwd||newPwd.length<6){setPwdError(t('auth.passwordTooShort'));return}; if(newPwd!==confirmPwd){setPwdError(t('auth.passwordsNotMatch'));return}; setPasswordChanging(true); try{await api('/api/password/change',{method:'POST',body:{currentPassword:currentPwd,newPassword:newPwd}});setShowChangePwd(false);setCurrentPwd('');setNewPwd('');setConfirmPwd('')}catch(err){setPwdError(err instanceof Error?err.message:'')}finally{setPasswordChanging(false)} }
  const handleSubmitClaim = async () => { if(!claimRef)return; setClaimSubmitting(true);setClaimError(null);setClaimSuccess(false); try{const res=await api<{success:boolean;claimId:number;preGranted:boolean}>('/api/payment/submit-claim',{method:'POST',body:{channel:claimChannel,externalReference:claimRef,merchantOrderNo:claimChannel==='alipay'?claimMerchant:null,paidTime:claimPaidTime||null,planType:claimPlanType,quantity:claimQuantity}});setShowClaimForm(false);setClaimRef('');setClaimMerchant('');setClaimPaidTime('');setClaimPlanType('monthly');setClaimQuantity(1);setClaimSuccess(true);setClaimPreGranted(res.preGranted===true);fetchMeGlobal()}catch(err){setClaimError(err instanceof Error?err.message:'')}finally{setClaimSubmitting(false)} }
  const handleRevokeSession = async (sessionId: number) => { setRevokingIds(prev => new Set(prev).add(sessionId)); try { await revokeSession(sessionId) } catch { /* error handled by store */ } finally { setRevokingIds(prev => { const next = new Set(prev); next.delete(sessionId); return next }) } }
  const handleLogout = async () => { setLogoutLoading(true); await logout(); router.replace(`/${locale}`) }

  // Redeem handler
  const handleRedeem = async () => {
    if (!redeemCode.trim()) return
    setRedeeming(true); setRedeemError(null); setRedeemResult(null)
    try {
      const res = await redeemCodeApi(redeemCode.trim())
      setRedeemResult({ days: res.days_granted, until: res.new_trial_until })
      setRedeemCode('')
      fetchMeGlobal()
    } catch (err) {
      setRedeemError(err instanceof ApiError ? err.code : 'unknown_error')
    } finally {
      setRedeeming(false)
    }
  }

  const localData = collectLocalData()
  const rows = buildSyncRows(localData, cloudData?.data as Record<string,unknown>|null)
  const hasCloudData = cloudVersion != null && cloudVersion > 0

  // Sync timestamps (from auto-sync hook)
  const [syncTs, setSyncTs] = useState(getSyncTimestamps)
  useEffect(() => subscribeSyncTimestamps(() => setSyncTs(getSyncTimestamps())), [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- conflict resolution requires multiple state updates */
    setAutoSyncConflictCallback((info) => {
      const originalResolve = info.resolve
      info.resolve = (choice) => {
        const result = originalResolve(choice)
        const clearIfStillThis = () => setConflict(prev => prev === info ? null : prev)
        if (result instanceof Promise) {
          result.then(clearIfStillThis)
        } else {
          clearIfStillThis()
        }
      }
      setConflict(info)
    })
    // Pick up any conflict that happened before this page mounted
    const pending = getPendingConflict()
    if (pending) {
      clearPendingConflict()
      // Set conflict lock so auto-sync doesn't bypass it
      setConflictPending(true)
      // Wrap the pending conflict's resolve the same way
      const originalResolve = pending.resolve
      pending.resolve = (choice) => {
        const result = originalResolve(choice)
        const clearIfStillThis = () => setConflict(prev => prev === pending ? null : prev)
        if (result instanceof Promise) {
          result.then(clearIfStillThis)
        } else {
          clearIfStillThis()
        }
      }
      setConflict(pending)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => setAutoSyncConflictCallback(null)
  }, [])

  // Auto-detect conflict when cloud data loads (e.g. navigated from conflict toast)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync conflict resolution requires multiple state updates */
    if (!cloudData?.data || !cloudVersion || cloudVersion <= 0 || conflict) return
    const localData = collectLocalData()
    const cloudRaw = cloudData.data as Record<string, unknown>
    resolveCloudWeaponIds(cloudRaw)
    if (hasExistingLocalData(localData) && syncDataDiffers(localData, cloudRaw)) {
      const lastSig = getLastSyncSignature()
      if (lastSig !== null && computeSyncSignature(localData) === lastSig) {
        setSkipNextPush(true)
        const r = cloudRaw
        try { const ep = r.essencePlanner as Record<string, unknown> | undefined; if (ep) { const current = JSON.parse(localStorage.getItem('matrix-session') || '{}'); const s = current?.state ?? current; if (Array.isArray(ep.selectedWeaponIds)) s.selectedWeaponIds = ep.selectedWeaponIds; if (ep.dungeonS1Selections) s.dungeonS1Selections = ep.dungeonS1Selections; localStorage.setItem('matrix-session', JSON.stringify({ ...current, state: s })) } } catch {}
        try { const es = r.essenceSettings as Record<string, unknown> | undefined; if (es) { const current = JSON.parse(localStorage.getItem('essence-settings') || '{}'); const s = current?.state ?? current; if (es.weaponOwnership) s.weaponOwnership = es.weaponOwnership; if (es.essenceStatus) s.essenceStatus = es.essenceStatus; if (es.weaponNotes) s.weaponNotes = es.weaponNotes; if (Array.isArray(es.customWeapons)) s.customWeapons = es.customWeapons; if (es.flags) Object.assign(s, es.flags); if (es.regionFirst !== undefined) s.regionFirst = es.regionFirst; if (es.regionSecond !== undefined) s.regionSecond = es.regionSecond; localStorage.setItem('essence-settings', JSON.stringify({ ...current, state: s })) } } catch {}
        try { const rp = r.refinementPlanner as Record<string, unknown> | undefined; if (rp) { const current = JSON.parse(localStorage.getItem('refinement-session') || '{}'); const s = current?.state ?? current; if (rp.selectedEquipId !== undefined) s.selectedEquipId = rp.selectedEquipId; localStorage.setItem('refinement-session', JSON.stringify({ ...current, state: s })) } } catch {}
        syncStoresFromCloudPayload(r)
        setSkipNextPush(false)
        setCloudVersion(cloudVersion)
        updateCloudVersion(cloudVersion)
        setLastSyncSignature(computeSyncSignature(cloudRaw))
        fetchCloud()
        return
      }
      // If cloud hasn't changed since last sync, local-only modifications
      // are just pending data, not a conflict.
      if (lastSig !== null && computeSyncSignature(cloudRaw) === lastSig) {
        return
      }
      const localRows = buildSummaryRows(localData)
      const cloudRows = buildSummaryRows(cloudRaw)
      const settingsDiff = buildSettingsDiff(localData, cloudRaw)
      setConflictPending(true)
      setConflict({
        type: 'pull_conflict',
        localSummary: localRows,
        cloudSummary: cloudRows,
        settingsDiff: settingsDiff.length > 0 ? settingsDiff : undefined,
        cloudVersion,
        cloudUpdatedAt: cloudData.updatedAt,
        resolve: (choice) => {
          if (choice === 'cloud') {
            setSkipNextPush(true)
            const r = cloudRaw
            try {
              const ep = r.essencePlanner as Record<string, unknown> | undefined
              if (ep) {
                const current = JSON.parse(localStorage.getItem('matrix-session') || '{}')
                const s = current?.state ?? current
                if (Array.isArray(ep.selectedWeaponIds)) s.selectedWeaponIds = ep.selectedWeaponIds
                if (ep.dungeonS1Selections) s.dungeonS1Selections = ep.dungeonS1Selections
                localStorage.setItem('matrix-session', JSON.stringify({ ...current, state: s }))
              }
            } catch {}
            try {
              const es = r.essenceSettings as Record<string, unknown> | undefined
              if (es) {
                const current = JSON.parse(localStorage.getItem('essence-settings') || '{}')
                const s = current?.state ?? current
                if (es.weaponOwnership) s.weaponOwnership = es.weaponOwnership
                if (es.essenceStatus) s.essenceStatus = es.essenceStatus
                if (es.weaponNotes) s.weaponNotes = es.weaponNotes
                if (Array.isArray(es.customWeapons)) s.customWeapons = es.customWeapons
                if (es.flags) Object.assign(s, es.flags)
                if (es.regionFirst !== undefined) s.regionFirst = es.regionFirst
                if (es.regionSecond !== undefined) s.regionSecond = es.regionSecond
                localStorage.setItem('essence-settings', JSON.stringify({ ...current, state: s }))
              }
            } catch {}
            try {
              const rp = r.refinementPlanner as Record<string, unknown> | undefined
              if (rp) {
                const current = JSON.parse(localStorage.getItem('refinement-session') || '{}')
                const s = current?.state ?? current
                if (rp.selectedEquipId !== undefined) s.selectedEquipId = rp.selectedEquipId
                localStorage.setItem('refinement-session', JSON.stringify({ ...current, state: s }))
              }
            } catch {}
            syncStoresFromCloudPayload(r)
            setSkipNextPush(false)
            setCloudVersion(cloudVersion)
            updateCloudVersion(cloudVersion)
            setLastSyncSignature(computeSyncSignature(cloudRaw))
            setConflictPending(false)
            setConflict(null)
            fetchCloud()
          }
          if (choice === 'local') {
            // Push local to cloud, then refresh display only after POST completes
            const localData = collectLocalData()
            postSyncDataApi({
              base_version: getCloudVersion() || cloudVersion,
              data: { schemaVersion: 2, capturedAt: new Date().toISOString(), ...localData },
            }, 'manual').then(res => {
              setCloudVersion(res.version)
              updateCloudVersion(res.version)
              setLastSyncSignature(computeSyncSignature(localData))
              return fetchCloud()
            }).then(() => {
              setConflictPending(false)
              setConflict(null)
            }).catch((err) => {
              // Keep conflict visible — do NOT clear conflict state.
              // Do NOT call fetchCloud() here; a successful GET would
              // mask the failed POST.
              setSyncStatus('error')
              setSyncError(getSyncErrorKey(err))
            })
          }
        },
      })
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [cloudData, cloudVersion, conflict, fetchCloud])

  // Show loading skeleton until client-side hydration completes,
  // preventing server-vs-client HTML mismatch from Zustand persist rehydration.
  if (!mounted) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border"><SidebarTrigger /><h1 className="text-base font-semibold tracking-tight">{t('account.title')}</h1></div>
        <div className="flex-1 flex items-center justify-center p-6">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!accessToken) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border"><SidebarTrigger /><h1 className="text-base font-semibold tracking-tight">{t('account.title')}</h1></div>
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-sm"><CardContent className="py-8 text-center space-y-4">
            <AlertTriangle className="size-8 text-amber-500 mx-auto" />
            <p className="text-muted-foreground">{t('account.sessionExpired')}</p>
            <Button onClick={() => router.push(`/${locale}/login?expired=1`)}>{t('nav.login')}</Button>
          </CardContent></Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border"><SidebarTrigger /><h1 className="text-base font-semibold tracking-tight">{t('account.title')}</h1></div>
      <div className="flex-1 overflow-y-auto p-6 [scrollbar-gutter:stable]"><div className="max-w-2xl mx-auto space-y-6">

        {/* ── Tab Navigation ── */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <Button variant="ghost" onClick={() => setAccountTab('account')} className={cn('flex-1 rounded-none py-2.5 text-sm font-medium transition-colors', accountTab === 'account' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50 text-muted-foreground')}>{t('account.tabAccount')}</Button>
          <Button variant="ghost" onClick={() => setAccountTab('membership')} className={cn('flex-1 rounded-none py-2.5 text-sm font-medium transition-colors', accountTab === 'membership' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50 text-muted-foreground')}>{t('account.tabMembership')}</Button>
        </div>

        {/* ── Tab: Account ── */}
        {accountTab === 'account' && <>

        {/* ── Profile ── */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Shield className="size-4"/>{t('account.profile')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('auth.username')}</span><span className="font-medium">{username}</span></div>
            <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">{t('auth.email')}</span><span className="font-medium inline-flex items-center gap-1">{showFullEmail ? (email ?? '—') : maskEmail(email)}<button type="button" onClick={() => setShowFullEmail(!showFullEmail)} className="inline-flex items-center justify-center size-5 rounded hover:bg-muted transition-colors" title={showFullEmail ? t('account.hideEmail') : t('account.showEmail')}>{showFullEmail ? <EyeOff className="size-3" /> : <Eye className="size-3" />}</button></span></div>
            <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">{t('account.emailVerified')}</span>{emailVerified?<Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle2 className="size-3 mr-1"/>{t('account.verified')}</Badge>:<Badge variant="outline" className="text-orange-600 border-orange-600"><AlertTriangle className="size-3 mr-1"/>{t('account.notVerified')}</Badge>}</div>
            <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">{t('account.planTier')}</span><span className="inline-flex items-center gap-1.5"><Badge className={displayTier==='premium'?'bg-purple-100 text-purple-700 border-purple-200':displayTier==='trial'?'bg-teal-100 text-teal-700 border-teal-200':'bg-muted text-muted-foreground'}>{displayTier==='premium'?'Premium':displayTier==='trial'?t('account.trial'):'Free'}</Badge>{isPreGrantedOnly&&<Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">{t('account.claimPending')}</Badge>}</span></div>
            {planExpireDate&&<div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('account.expiresAt')}</span><span className="font-medium text-xs">{new Date(planExpireDate).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>}
            <Separator/>
            {!emailVerified && <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between"><span>{t('account.emailNotVerifiedHint')}</span><Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleVerifyEmail} disabled={verifySending}>{verifySending?<Loader2 className="size-3 mr-1 animate-spin"/>:<Mail className="size-3 mr-1"/>}{t('account.verifyNow')}</Button></div>}
            {!emailVerified && <>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleVerifyEmail} disabled={verifySending}>
                {verifySending?<Loader2 className="size-4 mr-2 animate-spin"/>:<Mail className="size-4 mr-2"/>}
                {verifySent ? t('account.resendVerification') : t('account.sendVerification')}
              </Button>
              {verifySent && <p className="text-xs text-muted-foreground">{t('account.verificationSent')}</p>}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">{t('account.enterCodeHint')}</p>
                <div className="flex gap-2">
                  <Input className="h-8 text-xs bg-card border-border flex-1" value={verifyCode} onChange={e=>setVerifyCode(e.target.value)} placeholder={t('account.verificationCodePlaceholder')} maxLength={6} />
                  <Button size="sm" onClick={handleSubmitVerificationCode} disabled={!verifyCode||verifySubmitting}>
                    {verifySubmitting?<Loader2 className="size-4 mr-1 animate-spin"/>:null}
                    {t('account.submit')}
                  </Button>
                </div>
              </div>
              {verifyError&&<p className="text-xs text-destructive">{t(getErrorI18nKey(verifyError))}</p>}
            </>}
            {!showChangeEmail?<Button variant="ghost" size="sm" className="w-full justify-start" onClick={()=>setShowChangeEmail(true)}><Mail className="size-4 mr-2"/>{t('account.changeEmail')}</Button>:<div className="space-y-2 rounded-lg border border-border p-3">
            {!changeEmailSent ? <>
              <Label className="text-xs">{t('account.newEmail')}</Label>
              <Input className="h-8 text-xs bg-card border-border" value={newEmail} onChange={e=>setNewEmail(e.target.value)} type="email"/>
              {changeEmailError&&<p className="text-xs text-destructive">{t(getErrorI18nKey(changeEmailError))}</p>}
              <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={()=>{setShowChangeEmail(false);setChangeEmailError(null)}} disabled={emailChanging}>{t('account.cancel')}</Button><Button size="sm" onClick={handleChangeEmail} disabled={!newEmail||emailChanging}>{emailChanging?<Loader2 className="size-4 mr-1 animate-spin"/>:null}{t('account.submit')}</Button></div>
            </> : <>
              <p className="text-xs text-muted-foreground">{t('account.changeEmailSent')}</p>
              <div className="flex gap-2">
                <Input className="h-8 text-xs bg-card border-border flex-1" value={changeEmailCode} onChange={e=>setChangeEmailCode(e.target.value)} placeholder={t('account.verificationCodePlaceholder')} maxLength={6} />
                <Button size="sm" onClick={handleSubmitChangeEmailCode} disabled={!changeEmailCode||changeEmailCodeSubmitting}>
                  {changeEmailCodeSubmitting?<Loader2 className="size-4 mr-1 animate-spin"/>:null}
                  {t('account.submit')}
                </Button>
              </div>
              {changeEmailError&&<p className="text-xs text-destructive">{t(getErrorI18nKey(changeEmailError))}</p>}
              <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={()=>{setShowChangeEmail(false);setChangeEmailSent(false);setChangeEmailError(null);setChangeEmailCode('');setNewEmail('')}}>{t('account.cancel')}</Button></div>
            </>}
          </div>}
            {!showChangePwd?<Button variant="ghost" size="sm" className="w-full justify-start" onClick={()=>setShowChangePwd(true)}><Key className="size-4 mr-2"/>{t('account.changePassword')}</Button>:<div className="space-y-2 rounded-lg border border-border p-3"><Label className="text-xs">{t('account.currentPassword')}</Label><Input className="h-8 text-xs bg-card border-border" type="password" value={currentPwd} onChange={e=>setCurrentPwd(e.target.value)}/><Label className="text-xs">{t('account.newPassword')}</Label><Input className="h-8 text-xs bg-card border-border" type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)}/><Label className="text-xs">{t('auth.confirmPassword')}</Label><Input className="h-8 text-xs bg-card border-border" type="password" value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)}/>{pwdError&&<p className="text-xs text-destructive">{t(getErrorI18nKey(pwdError))}</p>}<p className="text-xs text-muted-foreground">{t('auth.passwordChangeHint')}</p><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={()=>{setShowChangePwd(false);setPwdError(null)}} disabled={passwordChanging}>{t('account.cancel')}</Button><Button size="sm" onClick={handleChangePassword} disabled={passwordChanging}>{passwordChanging?<Loader2 className="size-4 mr-1 animate-spin"/>:null}{t('account.submit')}</Button></div></div>}
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={handleLogout} disabled={logoutLoading}>{logoutLoading?<Loader2 className="size-4 mr-2 animate-spin"/>:<LogOut className="size-4 mr-2"/>}{t('nav.logout')}</Button>
          </CardContent>
        </Card>

        {/* ── Devices ── */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Monitor className="size-4"/>{t('account.devices')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sessionsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin"/>{t('account.syncing')}</div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('account.noDevices')}</p>
            ) : (
              <>
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div key={s.id} className={cn(
                      'flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs',
                      s.isCurrent && 'bg-muted/30'
                    )}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Monitor className="size-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{s.deviceName ?? t('account.unknownDevice')}</div>
                          <div className="text-muted-foreground text-[10px]">
                            {s.ip && <span>IP: {s.ip} · </span>}
                            {new Date(s.lastUsedAt ?? s.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {s.isCurrent ? (
                          <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] h-4 px-1.5">
                            {t('account.currentDevice')}
                          </Badge>
                        ) : revokingIds.has(s.id) ? (
                          <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRevokeSession(s.id)}
                          >
                            <X className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {t('account.deviceLimitHint', { count: sessions.length, max: 5 })}
                </p>
                <p className="text-[10px] text-muted-foreground">{t('account.deviceLogoutHint')}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Sync ── */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Cloud className="size-4"/>{t('account.syncStatus')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {syncStatus==='error' && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="size-4 text-red-500 shrink-0" />
                <span className="text-xs text-red-700 flex-1">{syncError ? t(syncError) : t('account.syncFailed')}</span>
                <Button variant="outline" size="sm" className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-100" onClick={() => fetchCloud()}>{t('account.retry')}</Button>
              </div>
            )}
            <div className="flex items-center text-xs"><span className="flex-1"/><span className="flex items-center gap-1 w-16 justify-end text-muted-foreground"><HardDrive className="size-3"/>{t('account.localData')}</span><span className="flex items-center gap-1 w-16 justify-end text-muted-foreground ml-4"><Cloud className="size-3"/>{t('account.cloudData')}</span></div>
            {rows.map(r => {
              const localDisplay = formatSyncCellVal(r.k, r.l, t)
              const cloudDisplay = formatSyncCellVal(r.k, r.c, t)
              const isEquip = r.k === 'syncRefinementSelection'
              return (
                <div key={r.k} className="flex items-center text-xs">
                  <span className="flex-1 text-muted-foreground">{t(r.label)}</span>
                  <span className={isEquip ? 'w-16 text-right truncate' : 'font-mono tabular-nums w-16 text-right'} title={isEquip ? localDisplay : undefined}>{localDisplay}</span>
                  <span className={isEquip ? 'w-16 text-right truncate ml-4' : 'font-mono tabular-nums w-16 text-right ml-4'} title={isEquip ? cloudDisplay : undefined}>{cloudDisplay}</span>
                </div>
              )
            })}
            <Separator/><div className="flex items-center gap-2 text-xs text-muted-foreground">{hasCloudData?<><CheckCircle2 className="size-3.5 text-green-500"/>{t('account.cloudVersion')}: v{cloudVersion}</>:<><Cloud className="size-3.5"/>{t('account.noCloudData')}</>}</div>
            {syncTs.cloudUpdatedAt && (
              <div className="text-[10px] text-muted-foreground">
                {t('account.cloudUpdatedAt')}: {formatTime(syncTs.cloudUpdatedAt)}
              </div>
            )}
            {syncTs.lastPullAt && (
              <div className="text-[10px] text-muted-foreground">
                {t('account.lastPullAt')}: {formatTime(new Date(syncTs.lastPullAt).toISOString())}
              </div>
            )}
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs flex items-center gap-1.5"><Zap className="size-3.5 text-purple-600"/>{t('account.autoSyncToggle')}</span>
                <Switch checked={autoSyncEnabled && hasAutoSync} onCheckedChange={setAutoSyncEnabled} disabled={!hasAutoSync} />
              </div>
              {!hasAutoSync && (
                <p className="text-[10px] text-muted-foreground pl-5">{t('account.autoSyncPremiumOnly')}</p>
              )}
              {autoSyncEnabled && hasAutoSync && (
                <>
                  <div className="flex items-center justify-between pl-5">
                    <span className="text-[11px] text-muted-foreground">{t('account.notifyOnSyncLabel')}</span>
                    <Switch checked={notifyOnSync} onCheckedChange={setNotifyOnSync} className="scale-75" />
                  </div>
                  <div className="flex items-center justify-between pl-5">
                    <span className="text-[11px] text-muted-foreground">{t('account.notifyOnPullLabel')}</span>
                    <Switch checked={notifyOnPull} onCheckedChange={setNotifyOnPull} className="scale-75" />
                  </div>
                  <div className="flex items-center justify-between pl-5">
                    <span className="text-[11px] text-muted-foreground">{t('account.notifyOnFailureLabel')}</span>
                    <Switch checked={true} disabled className="scale-75 opacity-50" />
                  </div>
                </>
              )}
            </div>
            {conflict ? (
              <SyncConflictDialog
                conflict={conflict}
                onResolve={(choice) => {
                  conflict.resolve(choice)
                  dismissConflictToast()
                }}
              />
            ) : hasCloudData && cloudData ? (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700"><AlertTriangle className="size-3.5 inline mr-1.5 -mt-0.5"/>{t('account.conflictHint')}</div>
            ) : null}
            <div className="flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={handlePull} disabled={syncStatus==='loading' || syncStatus==='pushing' || !!conflict}>{syncStatus==='loading'?<Loader2 className="size-4 mr-2 animate-spin"/>:<RefreshCw className="size-4 mr-2"/>}{t('account.pullFromCloud')}</Button><Button size="sm" className="flex-1" onClick={handlePush} disabled={syncStatus==='loading' || syncStatus==='pushing' || !!conflict}>{(syncStatus==='loading'||syncStatus==='pushing')?<Loader2 className="size-4 mr-2 animate-spin"/>:<Cloud className="size-4 mr-2"/>}{t('account.pushToCloud')}</Button></div>
          </CardContent>
        </Card>

        </>}

        {/* ── Tab: Membership ── */}
        {accountTab === 'membership' && <>

        {/* ── Premium ── */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Crown className="size-4"/>{t('account.premiumTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isTrial&&<div className="rounded-md bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-700">{t('account.trialHint')}</div>}
            <div className="rounded-lg border border-border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-muted/50"><th className="text-left px-3 py-2 font-medium">{t('account.feature')}</th><th className="text-center px-3 py-2 font-medium">Free</th><th className="text-center px-3 py-2 font-medium text-purple-600">Premium</th></tr></thead><tbody className="divide-y divide-border">{[['account.featSyncSize',t('account.featSyncSizeFree'),t('account.featSyncSizePremium')],['account.featAutoSync',t('account.notSupported'),t('account.supported')],['account.featWeaponOwnership','200','2,000'],['account.featEssenceStatus','200','2,000'],['account.featCustomWeapons',t('account.notSupported'),'300'],['account.featSelectedWeapons','200','500'],['account.featWeaponNotes','50','200']].map(([label,free,premium])=><tr key={label}><td className="px-3 py-2 text-muted-foreground">{t(label)}</td><td className="px-3 py-2 text-center">{free}</td><td className="px-3 py-2 text-center text-purple-600 font-medium">{premium}</td></tr>)}</tbody></table></div>
            {/* Pricing cards */}
            <div className="grid grid-cols-3 gap-2">
              {/* 月付 */}
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">{t('account.priceMonthly')}</div>
                <div className="text-lg font-bold text-foreground">{t('account.priceMonthlyAmount')}</div>
              </div>
              {/* 季付 */}
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">{t('account.priceQuarterly')}</div>
                <div className="text-lg font-bold text-foreground">{t('account.priceQuarterlyAmount')}</div>
                <div className="text-[10px] text-green-600 mt-0.5">{t('account.priceSave', { percent: '19' })}</div>
              </div>
              {/* 年付 */}
              <div className="rounded-lg border-2 border-purple-300 bg-purple-50/50 p-3 text-center relative">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">{t('account.priceRecommended')}</div>
                <div className="text-xs text-muted-foreground mb-1">{t('account.priceYearly')}</div>
                <div className="text-lg font-bold text-foreground">{t('account.priceYearlyAmount')}</div>
                <div className="text-[10px] text-green-600 mt-0.5">{t('account.priceSave', { percent: '40' })}</div>
              </div>
            </div>
            {/* Payment QR codes */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t('account.scanToPay')}</p>
              <div className="flex gap-3">
                <div className="flex-1 text-center">
                  <Image src="/images/payment/alipay.jpg" alt="Alipay" width={160} height={160} unoptimized className="w-full max-w-[160px] mx-auto rounded-lg border border-border" />
                  <span className="text-[10px] text-muted-foreground mt-1 block">{t('account.channelAlipay')}</span>
                </div>
                <div className="flex-1 text-center">
                  <Image src="/images/payment/wechat.png" alt="WeChat" width={160} height={160} unoptimized className="w-full max-w-[160px] mx-auto rounded-lg border border-border" />
                  <span className="text-[10px] text-muted-foreground mt-1 block">{t('account.channelWechat')}</span>
                </div>
              </div>
            </div>
            {!showClaimForm?<Button variant="outline" size="sm" className="w-full" onClick={()=>{setShowClaimForm(true);setClaimSuccess(false);setClaimPreGranted(false)}}><Send className="size-4 mr-2"/>{t('account.submitPayment')}</Button>:
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-col gap-2"><Label className="text-xs">{t('account.paymentChannel')}</Label><Select value={claimChannel} onValueChange={v=>{setClaimChannel(v??'alipay');setClaimMerchant('')}}><SelectTrigger className="h-8 text-xs"><SelectValue>{(v:string)=>v==='alipay'?t('account.channelAlipay'):t('account.channelWechat')}</SelectValue></SelectTrigger><SelectContent><SelectItem value="alipay">{t('account.channelAlipay')}</SelectItem><SelectItem value="wechat">{t('account.channelWechat')}</SelectItem></SelectContent></Select></div>
              <div className="flex flex-col gap-2"><Label className="text-xs">{t('account.planType')}</Label><Select value={claimPlanType} onValueChange={v=>setClaimPlanType(v??'monthly')}><SelectTrigger className="h-8 text-xs"><SelectValue>{(v:string)=>{const map:Record<string,string>={monthly:t('account.planMonthly'),quarterly:t('account.planQuarterly'),yearly:t('account.planYearly')};return map[v]??v}}</SelectValue></SelectTrigger><SelectContent><SelectItem value="monthly">{t('account.planMonthly')}</SelectItem><SelectItem value="quarterly">{t('account.planQuarterly')}</SelectItem><SelectItem value="yearly">{t('account.planYearly')}</SelectItem></SelectContent></Select></div>
              <div className="flex flex-col gap-1"><Label className="text-xs">{t('account.quantity')}</Label><Input className="h-8 text-xs bg-card border-border" type="number" min={1} max={999} value={claimQuantity} onChange={e=>setClaimQuantity(Math.max(1,Math.min(999,parseInt(e.target.value)||1)))} /></div>
              <div className="flex flex-col gap-1"><Label className="text-xs">{t('account.paymentTransactionId')}</Label><Input className="h-8 text-xs bg-card border-border" value={claimRef} onChange={e=>setClaimRef(e.target.value)} placeholder={t('account.paymentTransactionIdPlaceholder')}/></div>
              {claimChannel==='alipay'&&<div className="flex flex-col gap-1"><Label className="text-xs">{t('account.merchantOrderNo')}</Label><Input className="h-8 text-xs bg-card border-border" value={claimMerchant} onChange={e=>setClaimMerchant(e.target.value)} placeholder={t('account.merchantOrderNoPlaceholder')}/></div>}
              <div className="flex flex-col gap-1"><Label className="text-xs">{t('account.paymentTime')}</Label><Input className="h-8 text-xs bg-card border-border" type="datetime-local" value={claimPaidTime} onChange={e=>setClaimPaidTime(e.target.value)} /></div>
              {claimSuccess&&<div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 space-y-1"><p className="text-xs text-green-700 font-medium">{t('account.claimSubmitted')}</p>{claimPreGranted&&<p className="text-xs text-green-600">{t('account.claimSubmittedPreGranted')}</p>}</div>}
              {claimError&&<p className="text-xs text-destructive">{t(getErrorI18nKey(claimError))}</p>}
              <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={()=>{setShowClaimForm(false);setClaimError(null);setClaimSuccess(false);setClaimPreGranted(false)}}>{t('account.cancel')}</Button><Button size="sm" className="flex-1" onClick={handleSubmitClaim} disabled={!claimRef||claimSubmitting}>{claimSubmitting?<Loader2 className="size-4 mr-2 animate-spin"/>:null}{t('account.submit')}</Button></div>
            </div>}
            {paymentClaims.length>0&&<div className="space-y-2"><h4 className="text-xs font-medium text-muted-foreground">{t('account.paymentHistory')}</h4>{paymentClaims.map(c=><div key={c.id} className="rounded-md border border-border px-3 py-2 text-xs"><div className="flex justify-between items-center"><span className="text-muted-foreground">#{c.id} {c.channel==='alipay'?t('account.channelAlipay'):t('account.channelWechat')}</span><Badge className={cn(c.status==='approved'&&'bg-green-100 text-green-700',c.status==='rejected'&&'bg-red-100 text-red-700',c.status==='pending'&&'bg-amber-100 text-amber-700')}>{c.status==='approved'?t('account.claimApproved'):c.status==='rejected'?t('account.claimRejected'):t('account.claimPending')}</Badge></div><div className="text-muted-foreground mt-1">{c.external_reference}</div>{c.admin_note&&<div className="text-muted-foreground italic mt-0.5">{c.admin_note}</div>}</div>)}</div>}
          </CardContent>
        </Card>

        {/* ── Redeem ── */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Gift className="size-4"/>{t('account.redeemCode')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                className="h-9 text-sm bg-card border-border flex-1 font-mono"
                value={redeemCode}
                onChange={e => setRedeemCode(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
                placeholder={t('account.redeemCodePlaceholder')}
              />
              <Button size="sm" className="h-9" onClick={handleRedeem} disabled={!redeemCode.trim() || redeeming}>
                {redeeming ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
                {t('account.redeemButton')}
              </Button>
            </div>
            {redeemResult && (
              <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 text-xs text-green-700 dark:text-green-200">
                {t('account.redeemSuccess', { days: redeemResult.days })}
                <br />
                {t('account.redeemExpiresAt', { date: new Date(redeemResult.until).toLocaleString() })}
              </div>
            )}
            {redeemError && (
              <p className="text-xs text-destructive">{t(getErrorI18nKey(redeemError))}</p>
            )}
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium">{t('account.redeemHowToGet')}</span>
              <br />{t('account.redeemHowToGetHint')}
            </div>
            {redeemHistory.length > 0 && (
              <>
                <Separator />
                <h4 className="text-xs font-medium text-muted-foreground">{t('account.redeemHistory')}</h4>
                <div className="space-y-1">
                  {redeemHistory.map((h) => (
                    <div key={h.redeemed_at} className="flex justify-between text-xs text-muted-foreground">
                      <span>+{h.days_granted} {t('account.trial')}</span>
                      <span>{new Date(h.redeemed_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        </>}

      </div></div>
    </div>
  )
}
