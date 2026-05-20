'use client'

import { useState } from 'react'
import { AlertTriangle, Cloud, HardDrive, Upload, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { equipById } from '@/data/equips'
import type { SyncConflictInfo } from '@/hooks/useAutoSync'

interface SyncConflictDialogProps {
  conflict: SyncConflictInfo
  onResolve: (choice: 'cloud' | 'local') => void
}

const DATA_KEYS = [
  { k: 'weapons', label: 'account.syncPlannedWeapons' },
  { k: 'equip', label: 'account.syncRefinementSelection' },
  { k: 'ownership', label: 'account.syncWeaponOwnership' },
  { k: 'essence', label: 'account.syncEssenceStatus' },
  { k: 'customWeapons', label: 'account.syncCustomWeapons' },
  { k: 'weaponNotes', label: 'account.syncWeaponNotes' },
] as const

function formatRowVal(key: string, val: string, _t: ReturnType<typeof useTranslations>): string {
  if (key === 'equip') {
    if (!val) return '—'
    const equip = equipById.get(val)
    return equip?.name ?? val
  }
  if (val === '0' || val === '') return '—'
  return val
}

export function SyncConflictDialog({ conflict, onResolve }: SyncConflictDialogProps) {
  const t = useTranslations()
  const isPush = conflict.type === 'push_conflict'
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-700">
        <AlertTriangle className="size-5" />
        <span className="text-sm font-semibold">
          {isPush ? t('account.conflictTitlePush') : t('account.conflictTitle')}
        </span>
      </div>
      <p className="text-xs text-amber-600">
        {isPush ? t('account.conflictDescriptionPush') : t('account.conflictDescription')}
      </p>

      {/* Data comparison table */}
      <div className="rounded-md border border-amber-200 bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-amber-100/50">
              <th className="text-left px-3 py-1.5 font-medium text-amber-800">{t('account.feature')}</th>
              <th className="text-center px-3 py-1.5 font-medium text-amber-800">
                <span className="inline-flex items-center gap-1"><HardDrive className="size-3" />{t('account.localData')}</span>
              </th>
              <th className="text-center px-3 py-1.5 font-medium text-amber-800">
                <span className="inline-flex items-center gap-1"><Cloud className="size-3" />{t('account.cloudData')}</span>
              </th>
              <th className="w-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {DATA_KEYS.map(({ k, label }) => {
              const localVal = conflict.localSummary[k] ?? '0'
              const cloudVal = conflict.cloudSummary[k] ?? '0'
              const differs = localVal !== cloudVal
              return (
                <tr key={k} className={differs ? 'bg-amber-50/30' : ''}>
                  <td className="px-3 py-1 text-muted-foreground">{t(label)}</td>
                  <td className="px-3 py-1 text-center font-mono">
                    {formatRowVal(k, localVal, t)}
                  </td>
                  <td className="px-3 py-1 text-center font-mono">
                    {formatRowVal(k, cloudVal, t)}
                  </td>
                  <td className="pr-2 text-center">
                    {differs && <span className="text-[#0a72ef] text-[10px]">←</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Settings diff — collapsible */}
      {conflict.settingsDiff && conflict.settingsDiff.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 transition-colors"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            {settingsOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {t('account.settingsDiffToggle', { count: conflict.settingsDiff.length })}
          </button>
          {settingsOpen && (
            <div className="mt-2 rounded-md border border-amber-200 bg-white overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-amber-100/50">
                    <th className="text-left px-3 py-1.5 font-medium text-amber-800">{t('account.setting')}</th>
                    <th className="text-center px-3 py-1.5 font-medium text-amber-800">{t('account.localData')}</th>
                    <th className="text-center px-3 py-1.5 font-medium text-amber-800">{t('account.cloudData')}</th>
                    <th className="w-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {conflict.settingsDiff.map((entry, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1 text-muted-foreground">
                        {t(entry.i18nKey)}{entry.suffix ? ` ${entry.suffix}` : ''}
                      </td>
                      <td className="px-3 py-1 text-center font-mono">{entry.rawVal ? t(entry.localVal) : t(`account.${entry.localVal}`)}</td>
                      <td className="px-3 py-1 text-center font-mono">{entry.rawVal ? t(entry.cloudVal) : t(`account.${entry.cloudVal}`)}</td>
                      <td className="pr-2 text-center">
                        <span className="text-[#0a72ef] text-[10px]">←</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {conflict.cloudUpdatedAt && (
        <p className="text-[10px] text-amber-600">
          {t('account.cloudUpdatedAt')}: {new Date(conflict.cloudUpdatedAt).toLocaleString()}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-100"
          onClick={() => onResolve('local')}
        >
          <Upload className="size-4 mr-2" />
          {isPush ? t('account.keepLocalPush') : t('account.keepLocal')}
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
          onClick={() => onResolve('cloud')}
        >
          <Cloud className="size-4 mr-2" />
          {isPush ? t('account.useCloudPush') : t('account.useCloud')}
        </Button>
      </div>
    </div>
  )
}
