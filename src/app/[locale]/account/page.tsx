'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Cloud, HardDrive, AlertTriangle, CheckCircle2, Mail, Shield, RefreshCw, LogOut, Crown, Key, Send, Zap, Monitor, X, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { getSyncDataApi, postSyncDataApi, api, type SyncDataResponse } from '@/lib/api'
import { getSyncTimestamps, subscribeSyncTimestamps } from '@/hooks/useAutoSync'
import { cn, maskEmail, isValidEmail, formatTime } from '@/lib/utils'

// ─── Sync ────────────────────────────────────────────────────

function buildSyncRows(local: Record<string, unknown>, cloud: Record<string, unknown> | null) {
  const le = (local.essencePlanner ?? {}) as Record<string, unknown>
  const ls = (local.essenceSettings ?? {}) as Record<string, unknown>
  const lr = (local.refinementPlanner ?? {}) as Record<string, unknown>
  const ce = cloud ? ((cloud.essencePlanner ?? {}) as Record<string, unknown>) : null
  const cs = cloud ? ((cloud.essenceSettings ?? {}) as Record<string, unknown>) : null
  const cr = cloud ? ((cloud.refinementPlanner ?? {}) as Record<string, unknown>) : null
  return [
    { k: 'syncPlannedWeapons', label: 'account.syncPlannedWeapons', l: Array.isArray(le.selectedWeaponIds) ? le.selectedWeaponIds.length : 0, c: ce && Array.isArray(ce.selectedWeaponIds) ? ce.selectedWeaponIds.length : 0 },
    { k: 'syncRefinementSelection', label: 'account.syncRefinementSelection', l: lr.selectedEquipId ? 1 : 0, c: cr?.selectedEquipId ? 1 : 0 },
    { k: 'syncWeaponOwnership', label: 'account.syncWeaponOwnership', l: Object.keys((ls.weaponOwnership ?? {}) as object).length, c: cs ? Object.keys((cs.weaponOwnership ?? {}) as object).length : 0 },
    { k: 'syncEssenceStatus', label: 'account.syncEssenceStatus', l: Object.keys((ls.essenceStatus ?? {}) as object).length, c: cs ? Object.keys((cs.essenceStatus ?? {}) as object).length : 0 },
    { k: 'syncCustomWeapons', label: 'account.syncCustomWeapons', l: Array.isArray(ls.customWeapons) ? ls.customWeapons.length : 0, c: cs && Array.isArray(cs.customWeapons) ? cs.customWeapons.length : 0 },
    { k: 'syncWeaponNotes', label: 'account.syncWeaponNotes', l: Object.keys((ls.weaponNotes ?? {}) as object).length, c: cs ? Object.keys((cs.weaponNotes ?? {}) as object).length : 0 },
  ]
}

function collectLocalData(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  const data: Record<string, unknown> = {}
  try { const r = localStorage.getItem('matrix-session'); if (r) { const p = JSON.parse(r); const s = p?.state ?? p; data.essencePlanner = { selectedWeaponIds: s.selectedWeaponIds ?? [], dungeonS1Selections: s.dungeonS1Selections ?? {} } } } catch {}
  try { const r = localStorage.getItem('essence-settings'); if (r) { const p = JSON.parse(r); const s = p?.state ?? p; data.essenceSettings = { weaponOwnership: s.weaponOwnership ?? {}, essenceStatus: s.essenceStatus ?? {}, weaponNotes: s.weaponNotes ?? {}, customWeapons: s.customWeapons ?? [], flags: Object.fromEntries(['hideEssenceOwnedWeaponsList','hideEssenceOwnedWeaponsPlans','hideUnownedWeaponsList','hideUnownedWeaponsPlans','hideFourStarWeaponsList','hideFourStarWeaponsPlans','enableOwnershipEditList','enableOwnershipEditPlans','enableNotesList','enableNotesPlans','keepUpVisibleList','keepUpVisiblePlans','onlyHideWhenBothOwned'].map(k=>[k,s[k]??false])), regionFirst: s.regionFirst??null, regionSecond: s.regionSecond??null } } } catch {}
  try { const r = localStorage.getItem('refinement-session'); if (r) { const p = JSON.parse(r); const s = p?.state ?? p; data.refinementPlanner = { selectedEquipId: s.selectedEquipId ?? null } } } catch {}
  return data
}

// ─── Page ────────────────────────────────────────────────────

export default function AccountPage() {
  const t = useTranslations(); const locale = useLocale(); const router = useRouter()

  const username = useAuthStore(s => s.username)
  const email = useAuthStore(s => s.email)
  const emailVerified = useAuthStore(s => s.emailVerified)
  const planTier = useAuthStore(s => s.planTier)
  const premiumUntilStr = useAuthStore(s => s.premiumUntil)
  const premiumTrialStr = useAuthStore(s => s.premiumTrialUntil)
  const logout = useAuthStore(s => s.logout)
  const accessToken = useAuthStore(s => s.accessToken)
  const fetchMeGlobal = useAuthStore(s => s.fetchMe)
  const paymentClaims = useAuthStore(s => s.paymentClaims)

  // Sync
  const [cloudData, setCloudData] = useState<SyncDataResponse | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle'|'loading'|'pushing'|'error'|'success'>('idle')
  const [syncError, setSyncError] = useState<string|null>(null)
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string|null>(null)
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
  const [claimRef, setClaimRef] = useState(''); const [claimMerchant, setClaimMerchant] = useState(''); const [claimPaidTime, setClaimPaidTime] = useState(''); const [claimNote, setClaimNote] = useState('')
  const [claimSubmitting, setClaimSubmitting] = useState(false); const [claimError, setClaimError] = useState<string|null>(null)

  // Tier
  const premiumUntil = premiumUntilStr ? new Date(premiumUntilStr).getTime() : 0
  const trialUntil = premiumTrialStr ? new Date(premiumTrialStr).getTime() : 0
  const now = Date.now()
  const isTrial = !!(trialUntil > now && premiumUntil <= now)
  const isPremium = !!(premiumUntil > now)
  const displayTier: 'free'|'trial'|'premium' = isPremium ? 'premium' : isTrial ? 'trial' : 'free'
  const planExpireDate = isPremium ? premiumUntilStr : isTrial ? premiumTrialStr : null

  const fetchCloud = useCallback(async () => {
    if (!accessToken) return; setSyncStatus('loading'); setSyncError(null); setSyncSuccessMsg(null)
    try { const res = await getSyncDataApi(); setCloudData(res); setCloudVersion(res.version); setSyncStatus('success'); setSyncSuccessMsg(t('account.pullSuccess')) }
    catch { setSyncStatus('error'); setSyncError('account.fetchSyncFailed') }
  }, [accessToken, t])

  // Load data once on mount — /me now includes sessions, sync is separate but only on explicit user action.
  // No dependency on accessToken to avoid repeated calls from token refresh cascading.
  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    if (accessToken) { fetchMeGlobal() }
  }, [])

  const handlePush = async () => { setSyncStatus('pushing'); setSyncError(null); setSyncSuccessMsg(null); try { const localData = collectLocalData(); const res = await postSyncDataApi({ base_version: cloudVersion??0, data: { schemaVersion: 2, capturedAt: new Date().toISOString(), ...localData } }); setCloudVersion(res.version); setSyncStatus('success'); setSyncSuccessMsg(t('account.pushSuccess')); await fetchCloud() } catch (err) { setSyncStatus('error'); const msg = err instanceof Error ? err.message : ''; setSyncError(msg==='version_conflict'?'account.versionConflict':'account.pushSyncFailed') } }
  const handleVerifyEmail = async () => { setVerifySending(true); setVerifyError(null); try { await api('/api/email/send-verification',{method:'POST'}); setVerifySent(true) } catch (err) { setVerifyError(err instanceof Error ? err.message : 'send_failed') } finally { setVerifySending(false) } }
  const handleSubmitVerificationCode = async () => { if(!verifyCode)return; setVerifySubmitting(true); setVerifyError(null); try { await api('/api/email/verify',{method:'POST',body:{code:verifyCode}}); await fetchMeGlobal(); setVerifySent(false); setVerifyCode('') } catch (err) { setVerifyError(err instanceof Error ? err.message : 'invalid_code') } finally { setVerifySubmitting(false) } }
  const handleChangeEmail = async () => { if(!newEmail)return; if(!isValidEmail(newEmail)){setChangeEmailError('invalidEmail');return}; setEmailChanging(true); setChangeEmailError(null); try { await api('/api/email/request-change',{method:'POST',body:{newEmail}}); setChangeEmailSent(true) } catch (err) { setChangeEmailError(err instanceof Error ? err.message : 'send_failed') } finally { setEmailChanging(false) } }
  const handleSubmitChangeEmailCode = async () => { if(!changeEmailCode)return; setChangeEmailCodeSubmitting(true); setChangeEmailError(null); try { await api('/api/email/verify',{method:'POST',body:{code:changeEmailCode}}); await fetchMeGlobal(); setShowChangeEmail(false); setChangeEmailSent(false); setChangeEmailCode(''); setNewEmail('') } catch (err) { setChangeEmailError(err instanceof Error ? err.message : 'invalid_code') } finally { setChangeEmailCodeSubmitting(false) } }
  const handleChangePassword = async () => { setPwdError(null); if(!currentPwd||!newPwd||newPwd.length<6){setPwdError(t('auth.passwordTooShort'));return}; if(newPwd!==confirmPwd){setPwdError(t('auth.passwordsNotMatch'));return}; setPasswordChanging(true); try{await api('/api/password/change',{method:'POST',body:{currentPassword:currentPwd,newPassword:newPwd}});setShowChangePwd(false);setCurrentPwd('');setNewPwd('');setConfirmPwd('')}catch(err){setPwdError(err instanceof Error?err.message:'')}finally{setPasswordChanging(false)} }
  const handleSubmitClaim = async () => { if(!claimRef)return; setClaimSubmitting(true);setClaimError(null); try{await api('/api/payment/submit-claim',{method:'POST',body:{channel:claimChannel,externalReference:claimRef,merchantOrderNo:claimChannel==='alipay'?claimMerchant:null,paidTime:claimPaidTime||null,note:claimNote||null}});setShowClaimForm(false);setClaimRef('');setClaimMerchant('');setClaimPaidTime('');setClaimNote('')}catch(err){setClaimError(err instanceof Error?err.message:'')}finally{setClaimSubmitting(false)} }
  const handleRevokeSession = async (sessionId: number) => { setRevokingIds(prev => new Set(prev).add(sessionId)); await revokeSession(sessionId); setRevokingIds(prev => { const next = new Set(prev); next.delete(sessionId); return next }) }
  const handleLogout = async () => { setLogoutLoading(true); await logout(); router.replace(`/${locale}`) }

  const localData = collectLocalData()
  const rows = buildSyncRows(localData, cloudData?.data as Record<string,unknown>|null)
  const hasCloudData = cloudVersion != null && cloudVersion > 0

  // Sync timestamps (from auto-sync hook)
  const [syncTs, setSyncTs] = useState(getSyncTimestamps)
  useEffect(() => subscribeSyncTimestamps(() => setSyncTs(getSyncTimestamps())), [])

  if (!accessToken) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border"><SidebarTrigger /><h1 className="text-base font-semibold">{t('account.title')}</h1></div>
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
      <div className="flex-1 overflow-y-auto p-6"><div className="max-w-2xl mx-auto space-y-6">

        {/* ── Profile ── */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Shield className="size-4"/>{t('account.profile')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('auth.username')}</span><span className="font-medium">{username}</span></div>
            <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">{t('auth.email')}</span><span className="font-medium inline-flex items-center gap-1">{showFullEmail ? (email ?? '—') : maskEmail(email)}<button type="button" onClick={() => setShowFullEmail(!showFullEmail)} className="inline-flex items-center justify-center size-5 rounded hover:bg-muted transition-colors" title={showFullEmail ? t('account.hideEmail') : t('account.showEmail')}>{showFullEmail ? <EyeOff className="size-3" /> : <Eye className="size-3" />}</button></span></div>
            <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">{t('account.emailVerified')}</span>{emailVerified?<Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle2 className="size-3 mr-1"/>{t('account.verified')}</Badge>:<Badge variant="outline" className="text-orange-600 border-orange-600"><AlertTriangle className="size-3 mr-1"/>{t('account.notVerified')}</Badge>}</div>
            <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">{t('account.planTier')}</span><Badge className={displayTier==='premium'?'bg-purple-100 text-purple-700 border-purple-200':displayTier==='trial'?'bg-teal-100 text-teal-700 border-teal-200':'bg-muted text-muted-foreground'}>{displayTier==='premium'?'Premium':displayTier==='trial'?t('account.trial'):'Free'}</Badge></div>
            {planExpireDate&&<div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('account.expiresAt')}</span><span className="font-medium text-xs">{new Date(planExpireDate).toLocaleDateString()}</span></div>}
            {isPremium&&<div className="flex items-center gap-2 text-xs text-purple-600"><Zap className="size-3.5"/>{t('account.autoSyncEnabled')}</div>}
            <Separator/>
            {!emailVerified&&<>
            {!verifySent ? (
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleVerifyEmail} disabled={verifySending}>
                {verifySending?<Loader2 className="size-4 mr-2 animate-spin"/>:<Mail className="size-4 mr-2"/>}
                {t('account.sendVerification')}
              </Button>
            ) : (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t('account.verificationSent')}</p>
                <div className="flex gap-2">
                  <Input className="h-8 text-xs bg-card border-border flex-1" value={verifyCode} onChange={e=>setVerifyCode(e.target.value)} placeholder={t('account.verificationCodePlaceholder')} maxLength={6} />
                  <Button size="sm" onClick={handleSubmitVerificationCode} disabled={!verifyCode||verifySubmitting}>
                    {verifySubmitting?<Loader2 className="size-4 mr-1 animate-spin"/>:null}
                    {t('account.submit')}
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="text-xs" onClick={handleVerifyEmail} disabled={verifySending}>
                  {t('account.resendVerification')}
                </Button>
              </div>
            )}
            {verifyError&&<p className="text-xs text-destructive">{t(`auth.${verifyError}`)}</p>}
          </>}
            {!showChangeEmail?<Button variant="ghost" size="sm" className="w-full justify-start" onClick={()=>setShowChangeEmail(true)}><Mail className="size-4 mr-2"/>{t('account.changeEmail')}</Button>:<div className="space-y-2 rounded-lg border border-border p-3">
            {!changeEmailSent ? <>
              <Label className="text-xs">{t('account.newEmail')}</Label>
              <Input className="h-8 text-xs bg-card border-border" value={newEmail} onChange={e=>setNewEmail(e.target.value)} type="email"/>
              {changeEmailError&&<p className="text-xs text-destructive">{t(`auth.${changeEmailError}`)}</p>}
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
              {changeEmailError&&<p className="text-xs text-destructive">{t(`auth.${changeEmailError}`)}</p>}
              <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={()=>{setShowChangeEmail(false);setChangeEmailSent(false);setChangeEmailError(null);setChangeEmailCode('');setNewEmail('')}}>{t('account.cancel')}</Button></div>
            </>}
          </div>}
            {!showChangePwd?<Button variant="ghost" size="sm" className="w-full justify-start" onClick={()=>setShowChangePwd(true)}><Key className="size-4 mr-2"/>{t('account.changePassword')}</Button>:<div className="space-y-2 rounded-lg border border-border p-3"><Label className="text-xs">{t('account.currentPassword')}</Label><Input className="h-8 text-xs bg-card border-border" type="password" value={currentPwd} onChange={e=>setCurrentPwd(e.target.value)}/><Label className="text-xs">{t('account.newPassword')}</Label><Input className="h-8 text-xs bg-card border-border" type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)}/><Label className="text-xs">{t('auth.confirmPassword')}</Label><Input className="h-8 text-xs bg-card border-border" type="password" value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)}/>{pwdError&&<p className="text-xs text-destructive">{pwdError}</p>}<div className="flex gap-2"><Button variant="ghost" size="sm" onClick={()=>{setShowChangePwd(false);setPwdError(null)}} disabled={passwordChanging}>{t('account.cancel')}</Button><Button size="sm" onClick={handleChangePassword} disabled={passwordChanging}>{passwordChanging?<Loader2 className="size-4 mr-1 animate-spin"/>:null}{t('account.submit')}</Button></div></div>}
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
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Sync ── */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Cloud className="size-4"/>{t('account.syncStatus')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center text-xs"><span className="flex-1"/><span className="flex items-center gap-1 w-16 justify-end text-muted-foreground"><HardDrive className="size-3"/>{t('account.localData')}</span><span className="flex items-center gap-1 w-16 justify-end text-muted-foreground ml-4"><Cloud className="size-3"/>{t('account.cloudData')}</span></div>
            {rows.map(r=><div key={r.k} className="flex items-center text-xs"><span className="flex-1 text-muted-foreground">{t(r.label)}</span><span className="font-mono tabular-nums w-16 text-right">{r.l}</span><span className="font-mono tabular-nums w-16 text-right ml-4">{r.c}</span></div>)}
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
            {isPremium && <div className="flex items-center gap-2 text-xs text-purple-600"><Zap className="size-3.5"/>{t('account.autoSyncEnabled')}</div>}
            {syncStatus==='error'&&syncError&&<p className="text-xs text-destructive">{t(syncError)}</p>}
            {syncStatus==='success'&&syncSuccessMsg&&<p className="text-xs text-green-600">{syncSuccessMsg}</p>}
            {hasCloudData&&<div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700"><AlertTriangle className="size-3.5 inline mr-1.5 -mt-0.5"/>{t('account.conflictHint')}</div>}
            <div className="flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={fetchCloud} disabled={syncStatus==='loading'}><RefreshCw className="size-4 mr-2"/>{t('account.pullFromCloud')}</Button><Button size="sm" className="flex-1" onClick={handlePush} disabled={syncStatus==='pushing'}>{syncStatus==='pushing'?<Loader2 className="size-4 mr-2 animate-spin"/>:<Cloud className="size-4 mr-2"/>}{t('account.pushToCloud')}</Button></div>
          </CardContent>
        </Card>

        {/* ── Premium ── */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Crown className="size-4"/>{t('account.premiumTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isTrial&&<div className="rounded-md bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-700">{t('account.trialHint')}</div>}
            <div className="rounded-lg border border-border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-muted/50"><th className="text-left px-3 py-2 font-medium">{t('account.feature')}</th><th className="text-center px-3 py-2 font-medium">Free</th><th className="text-center px-3 py-2 font-medium text-purple-600">Premium</th></tr></thead><tbody className="divide-y divide-border">{[['account.featSyncSize',t('account.featSyncSizeFree'),t('account.featSyncSizePremium')],['account.featAutoSync',t('account.notSupported'),t('account.supported')],['account.featWeaponOwnership','200','2,000'],['account.featEssenceStatus','200','2,000'],['account.featCustomWeapons',t('account.notSupported'),'300'],['account.featSelectedWeapons','200','500'],['account.featWeaponNotes','50','200']].map(([label,free,premium])=><tr key={label}><td className="px-3 py-2 text-muted-foreground">{t(label)}</td><td className="px-3 py-2 text-center">{free}</td><td className="px-3 py-2 text-center text-purple-600 font-medium">{premium}</td></tr>)}</tbody></table></div>
            <div className="grid grid-cols-3 gap-2">{[{label:'account.priceMonthly',price:'¥30'},{label:'account.priceQuarterly',price:'¥80'},{label:'account.priceYearly',price:'¥288'}].map(p=><div key={p.label} className="rounded-lg border border-border p-3 text-center"><div className="text-xs text-muted-foreground mb-1">{t(p.label)}</div><div className="text-lg font-bold text-[#171717]">{p.price}</div></div>)}</div>
            {!showClaimForm?<Button variant="outline" size="sm" className="w-full" onClick={()=>setShowClaimForm(true)}><Send className="size-4 mr-2"/>{t('account.submitPayment')}</Button>:
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-col gap-2"><Label className="text-xs">{t('account.paymentChannel')}</Label><Select value={claimChannel} onValueChange={v=>{setClaimChannel(v??'alipay');setClaimMerchant('')}}><SelectTrigger className="h-8 text-xs"><SelectValue>{(v:string)=>v==='alipay'?t('account.channelAlipay'):t('account.channelWechat')}</SelectValue></SelectTrigger><SelectContent><SelectItem value="alipay">{t('account.channelAlipay')}</SelectItem><SelectItem value="wechat">{t('account.channelWechat')}</SelectItem></SelectContent></Select></div>
              <div className="flex flex-col gap-1"><Label className="text-xs">{t('account.paymentTransactionId')}</Label><Input className="h-8 text-xs bg-card border-border" value={claimRef} onChange={e=>setClaimRef(e.target.value)} placeholder={t('account.paymentTransactionIdPlaceholder')}/></div>
              {claimChannel==='alipay'&&<div className="flex flex-col gap-1"><Label className="text-xs">{t('account.merchantOrderNo')}</Label><Input className="h-8 text-xs bg-card border-border" value={claimMerchant} onChange={e=>setClaimMerchant(e.target.value)} placeholder={t('account.merchantOrderNoPlaceholder')}/></div>}
              <div className="flex flex-col gap-1"><Label className="text-xs">{t('account.paymentTime')}</Label><Input className="h-8 text-xs bg-card border-border" type="datetime-local" value={claimPaidTime} onChange={e=>setClaimPaidTime(e.target.value)} /></div>
              <div className="flex flex-col gap-1"><Label className="text-xs">{t('account.paymentNote')}</Label><Input className="h-8 text-xs bg-card border-border" value={claimNote} onChange={e=>setClaimNote(e.target.value)} placeholder={t('account.paymentNotePlaceholder')}/></div>
              {claimError&&<p className="text-xs text-destructive">{claimError}</p>}
              <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={()=>{setShowClaimForm(false);setClaimError(null)}}>{t('account.cancel')}</Button><Button size="sm" className="flex-1" onClick={handleSubmitClaim} disabled={!claimRef||claimSubmitting}>{claimSubmitting?<Loader2 className="size-4 mr-2 animate-spin"/>:null}{t('account.submit')}</Button></div>
            </div>}
            {paymentClaims.length>0&&<div className="space-y-2"><h4 className="text-xs font-medium text-muted-foreground">{t('account.paymentHistory')}</h4>{paymentClaims.map(c=><div key={c.id} className="rounded-md border border-border px-3 py-2 text-xs"><div className="flex justify-between items-center"><span className="text-muted-foreground">#{c.id} {c.channel==='alipay'?t('account.channelAlipay'):t('account.channelWechat')}</span><Badge className={cn(c.status==='approved'&&'bg-green-100 text-green-700',c.status==='rejected'&&'bg-red-100 text-red-700',c.status==='pending'&&'bg-amber-100 text-amber-700')}>{c.status==='approved'?t('account.claimApproved'):c.status==='rejected'?t('account.claimRejected'):t('account.claimPending')}</Badge></div><div className="text-muted-foreground mt-1">{c.external_reference}</div>{c.admin_note&&<div className="text-muted-foreground italic mt-0.5">{c.admin_note}</div>}</div>)}</div>}
          </CardContent>
        </Card>

      </div></div>
    </div>
  )
}
