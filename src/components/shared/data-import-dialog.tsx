'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import PreviewToggle from '@/components/shared/preview-toggle'
import { cn } from '@/lib/utils'
import { useDataImportStore } from '@/stores/useDataImportStore'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import {
  buildSummary,
  countItems,
  getIoModules,
  getKnownModuleIds,
  EXPORT_FORMAT_VERSION,
  MAX_ITEMS_PER_MODULE,
} from '@/lib/data-io-utils'
import { importModule } from '@/lib/data-import'
import type { PreparedImport } from '@/lib/data-import'
import { applyMaaEndEssence, listFileAccounts, type EssenceRestoreMode } from '@/lib/essence-import/apply'
import { showAppToast } from '@/lib/app-toast'

/** Unknown MaaEND weapon ids rendered before the list is truncated. */
const UNKNOWN_WEAPON_LIST_LIMIT = 20

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// ─── 对话框主体 ───────────────────────────────────────────────

interface DataImportDialogBodyProps {
  fileName: string
  prepared: PreparedImport
  onDone: () => void
}

/**
 * Format-aware import confirmation.
 *
 * Mounted per request (keyed by request id), so every file starts with fresh
 * selections and a target account that defaults to the current active one.
 */
function DataImportDialogBody({ fileName, prepared, onDone }: DataImportDialogBodyProps) {
  const t = useTranslations()
  const modules = useMemo(() => getIoModules(t), [t])
  const knownIds = useMemo(() => getKnownModuleIds(t), [t])

  const accounts = useEssenceSettingsStore((s) => s.accounts)
  const activeAccountId = useEssenceSettingsStore((s) => s.activeAccountId)
  const markSuccess = useDataImportStore((s) => s.markSuccess)

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? accounts[0],
    [accounts, activeAccountId],
  )
  const accountLabel = useCallback(
    (id: string) => accounts.find((account) => account.id === id)?.name || '—',
    [accounts],
  )

  const kind = prepared.kind
  const file = prepared.file
  const inventory = prepared.inventory

  const [checked, setChecked] = useState<Set<string>>(() => {
    if (!file) return new Set()
    // 默认选中「有数据且未超上限」的模块
    return new Set(
      modules
        .filter((mod) => {
          const count = countItems(mod.id, file.modules[mod.id])
          if (count === 0) return false
          return count <= (MAX_ITEMS_PER_MODULE[mod.id] ?? 10000)
        })
        .map((mod) => mod.id),
    )
  })
  const [essenceMode, setEssenceMode] = useState<EssenceRestoreMode>('restore')
  const [targetAccountId, setTargetAccountId] = useState(() => activeAccount?.id ?? '')
  const [sourceAccountId, setSourceAccountId] = useState('')

  const summaries = useMemo(
    () =>
      modules.map((mod) => {
        const data = file?.modules[mod.id]
        const itemCount = countItems(mod.id, data)
        return {
          id: mod.id,
          label: mod.label,
          data,
          itemCount,
          hasData: itemCount > 0,
          withinLimit: itemCount <= (MAX_ITEMS_PER_MODULE[mod.id] ?? 10000),
          summary: buildSummary(mod.id, data, t),
        }
      }),
    [file, modules, t],
  )

  const essenceModule = file?.modules['essence-settings']
  const essenceChecked = checked.has('essence-settings')
  const fileHasAccounts =
    isRecord(essenceModule) && Array.isArray(essenceModule.accounts) && essenceModule.accounts.length > 0
  // A file without accounts can only be folded into a local account. Its globals
  // are deliberately NOT applied (see importModeActiveDesc).
  const effectiveEssenceMode: EssenceRestoreMode = fileHasAccounts ? essenceMode : 'active'
  const fileAccounts = useMemo(() => listFileAccounts(essenceModule), [essenceModule])
  /** The file's own active account (its per-account marks are what a single-account import applies). */
  const fileActiveAccountId =
    isRecord(essenceModule) && typeof essenceModule.activeAccountId === 'string'
      ? essenceModule.activeAccountId
      : ''
  const sourceAccount = useMemo(
    () =>
      fileAccounts.find((account) => account.id === sourceAccountId) ??
      fileAccounts.find((account) => account.id === fileActiveAccountId) ??
      fileAccounts[0],
    [fileAccounts, fileActiveAccountId, sourceAccountId],
  )
  const showAccountPicker =
    accounts.length > 1 && (kind === 'maamend-essence' || (essenceChecked && effectiveEssenceMode === 'active'))
  const showSourcePicker =
    essenceChecked && fileHasAccounts && effectiveEssenceMode === 'active' && fileAccounts.length > 1

  /** Essence marks gained / cleared by a MaaEND replace, for the warning line. */
  const inventoryDiff = useMemo(() => {
    if (!inventory) return null
    const target = accounts.find((account) => account.id === targetAccountId) ?? accounts[0]
    const incoming = new Set(inventory.weaponIds)
    const existing = Object.entries(target?.essenceStatus ?? {})
      .filter(([, status]) => status === true)
      .map(([weaponId]) => weaponId)
    const existingSet = new Set(existing)
    return {
      added: inventory.weaponIds.filter((weaponId) => !existingSet.has(weaponId)).length,
      removed: existing.filter((weaponId) => !incoming.has(weaponId)).length,
    }
  }, [inventory, accounts, targetAccountId])

  const toggle = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleConfirm = useCallback(async () => {
    if (kind === 'maamend-essence') {
      if (!inventory) return
      applyMaaEndEssence(inventory.weaponIds, targetAccountId)
      markSuccess()
      onDone()
      return
    }
    if (kind !== 'cep-backup' || !file) return
    for (const mod of modules) {
      if (!checked.has(mod.id)) continue
      if (!knownIds.has(mod.id)) continue
      const rawData = file.modules[mod.id]
      if (rawData === null || rawData === undefined) continue
      if (countItems(mod.id, rawData) > (MAX_ITEMS_PER_MODULE[mod.id] ?? 10000)) continue
      // Sequential: modules are independent but lazily-loaded stores must settle
      // before the dialog closes.
      await importModule(mod.id, rawData, {
        essence: {
          mode: effectiveEssenceMode,
          accountId: targetAccountId,
          sourceAccountId: sourceAccount ? sourceAccount.id : undefined,
        },
      })
    }
    markSuccess()
    onDone()
  }, [
    checked, effectiveEssenceMode, file, inventory, kind, knownIds, markSuccess, modules, onDone,
    sourceAccount, targetAccountId,
  ])

  const formatLabel =
    kind === 'cep-backup'
      ? t('settings.importFormatCep')
      : kind === 'maamend-essence'
        ? t('settings.importFormatMaaEnd')
        : t('settings.importFormatUnknown')

  const confirmDisabled =
    kind === 'maamend-essence' ? inventory === null : kind === 'cep-backup' ? checked.size === 0 : true

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('settings.importTitle')}</DialogTitle>
        <DialogDescription>{t('settings.importDesc', { file: fileName })}</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
          <span className="text-muted-foreground">{t('settings.importFormat')}</span>
          <span className="font-medium truncate">{formatLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
          <span className="text-muted-foreground">{t('settings.importActiveAccount')}</span>
          <span className="font-medium truncate">{activeAccount ? accountLabel(activeAccount.id) : '—'}</span>
        </div>

        {file?.exportedAt ? (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>{t('settings.importExportedAt')}: {new Date(file.exportedAt).toLocaleString()}</p>
            {file.appVersion ? <p>{t('settings.importExportedBy')}: {file.appVersion}</p> : null}
            {file.device?.platform ? <p>{t('settings.importDevice')}: {file.device.platform}</p> : null}
          </div>
        ) : null}

        {file && file.version > EXPORT_FORMAT_VERSION ? (
          <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
            <span>{t('settings.importNewerVersionWarning', { version: file.version })}</span>
          </div>
        ) : null}

        {kind === null || (kind === 'cep-backup' && !file) ? (
          <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
            <span>{t('settings.importInvalidFormat')}</span>
          </div>
        ) : null}

        {kind === 'maamend-essence' && !inventory ? (
          <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
            <span>{t('settings.importFormatMaaEndInvalid')}</span>
          </div>
        ) : null}

        {kind === 'maamend-essence' && inventory ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t('settings.importMaaEndSummary', {
                groups: inventory.groupCount,
                weapons: inventory.weaponIds.length,
              })}
            </p>

            {inventory.unknownWeaponIds.length > 0 ? (
              <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
                <div className="flex-1 space-y-1">
                  <span>{t('settings.importMaaEndUnknownWeapons', { count: inventory.unknownWeaponIds.length })}</span>
                  {/* Raw ids only: a weapon the dataset does not know has no name in any locale. */}
                  <ul className="max-h-24 overflow-y-auto font-mono text-[11px] leading-relaxed">
                    {inventory.unknownWeaponIds.slice(0, UNKNOWN_WEAPON_LIST_LIMIT).map((weaponId) => (
                      <li key={weaponId}>{weaponId}</li>
                    ))}
                  </ul>
                  {inventory.unknownWeaponIds.length > UNKNOWN_WEAPON_LIST_LIMIT ? (
                    <span>
                      {t('settings.importMaaEndUnknownWeaponsMore', {
                        count: inventory.unknownWeaponIds.length - UNKNOWN_WEAPON_LIST_LIMIT,
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">{t('settings.importMaaEndIgnoreLevels')}</p>

            {inventoryDiff && inventoryDiff.removed > 0 ? (
              <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  {t('settings.importMaaEndReplaceWarning', {
                    name: accountLabel(targetAccountId),
                    added: inventoryDiff.added,
                    removed: inventoryDiff.removed,
                  })}
                </span>
              </div>
            ) : null}

            {inventory.groupCount === 0 ? (
              <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>{t('settings.importMaaEndEmpty')}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {kind === 'cep-backup' && file ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('settings.importSelectModules')}</p>
            <div className="space-y-0.5">
              {summaries.map((entry) => (
                <div key={entry.id}>
                  <div
                    className={cn(
                      'flex items-center gap-2 px-1 py-2 hover:bg-neutral-50 rounded transition-colors flex-wrap select-none',
                      (!entry.hasData || !entry.withinLimit) && 'opacity-50',
                    )}
                  >
                    <Checkbox
                      checked={checked.has(entry.id)}
                      onCheckedChange={() => toggle(entry.id)}
                      disabled={!entry.hasData || !entry.withinLimit}
                    />
                    <span className="flex-1 text-sm cursor-default">{entry.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 cursor-pointer">
                      {!entry.withinLimit ? '⚠ ' : ''}{entry.summary}
                    </span>
                    <PreviewToggle data={entry.data} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {kind === 'cep-backup' && file && essenceChecked && fileHasAccounts ? (
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs">{t('settings.importAccountMode')}</Label>
            <Select
              value={effectiveEssenceMode}
              onValueChange={(value: string | null) => {
                if (value === 'restore' || value === 'active') setEssenceMode(value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) =>
                    value === 'restore'
                      ? t('settings.importModeRestore')
                      : t('settings.importModeActive')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restore">{t('settings.importModeRestore')}</SelectItem>
                <SelectItem value="active">{t('settings.importModeActive')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {effectiveEssenceMode === 'restore'
                ? t('settings.importModeRestoreDesc')
                : t('settings.importModeActiveDesc')}
            </p>
          </div>
        ) : null}

        {kind === 'cep-backup' && file && essenceChecked && !fileHasAccounts ? (
          <p className="text-xs text-muted-foreground pt-1">{t('settings.importNoAccountsNote')}</p>
        ) : null}

        {kind === 'cep-backup' && file && showSourcePicker ? (
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs">{t('settings.importSourceAccount')}</Label>
            <Select
              value={sourceAccount ? sourceAccount.id : ''}
              onValueChange={(value: string | null) => {
                if (value) setSourceAccountId(value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) => {
                    const account = fileAccounts.find((entry) => entry.id === value)
                    return account ? account.name || '—' : '—'
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {fileAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <span className="flex-1 truncate">{account.name || '—'}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{account.markCount}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {showAccountPicker ? (
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs">{t('settings.importTargetAccount')}</Label>
            <Select
              value={targetAccountId}
              onValueChange={(value: string | null) => {
                if (value) setTargetAccountId(value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string) => accountLabel(value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name || '—'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          {t('settings.cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={confirmDisabled}
          onClick={() => void handleConfirm()}
        >
          {t('settings.importConfirm')}
        </Button>
      </div>
    </>
  )
}

// ─── 全局对话框 + 提示 ────────────────────────────────────────

/**
 * Global import dialog.
 *
 * Mounted once in the locale layout so the file picker (settings page) and the
 * global drag & drop overlay both funnel into the same confirmation UI.
 */
export function DataImportDialog() {
  const t = useTranslations()
  const request = useDataImportStore((s) => s.request)
  const close = useDataImportStore((s) => s.close)
  const errorKey = useDataImportStore((s) => s.errorKey)
  const clearError = useDataImportStore((s) => s.clearError)
  const success = useDataImportStore((s) => s.success)
  const dismissSuccess = useDataImportStore((s) => s.dismissSuccess)

  // 导入结果走全局单槽位 toast（SyncNotifier）—— 自己再渲染一个
  // fixed bottom-6 right-6 会和同步冲突通知完全重叠。
  useEffect(() => {
    if (!errorKey) return
    showAppToast({ tone: 'error', text: t(errorKey) })
    clearError()
  }, [errorKey, t, clearError])

  useEffect(() => {
    if (!success) return
    showAppToast({ tone: 'success', text: t('settings.importSuccess') })
    dismissSuccess()
  }, [success, t, dismissSuccess])

  return (
    <>
      <Dialog open={request !== null} onOpenChange={(open) => { if (!open) close() }}>
        {/* The dialog can carry 8 module rows + account pickers + warnings; without
            a height cap the confirm button ends up outside a short viewport.
            z-[70] 让设置类弹窗盖过右下角通知（toast 为 z-[60]）。 */}
        <DialogContent className="sm:max-w-md z-[70] max-h-[calc(100dvh-2rem)] overflow-y-auto">
          {request ? (
            <DataImportDialogBody
              key={request.id}
              fileName={request.fileName}
              prepared={request.prepared}
              onDone={close}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
