'use client'

import { useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { useMatrixStore } from '@/stores/useMatrixStore'
import { useRefinementStore } from '@/stores/useRefinementStore'
import { useAuthStore } from '@/stores/useAuthStore'

// ─── 数据模块定义 ──────────────────────────────────────────────

interface DataModule {
  id: string
  label: string
  description: string
  keys: string[]
}

function buildModules(t: ReturnType<typeof useTranslations>): DataModule[] {
  return [
    {
      id: 'essence-settings',
      label: t('dataCleaner.modules.essence-settings.label'),
      description: t('dataCleaner.modules.essence-settings.desc'),
      keys: ['essence-settings'],
    },
    {
      id: 'matrix-session',
      label: t('dataCleaner.modules.matrix-session.label'),
      description: t('dataCleaner.modules.matrix-session.desc'),
      keys: ['matrix-session'],
    },
    {
      id: 'refinement-session',
      label: t('dataCleaner.modules.refinement-session.label'),
      description: t('dataCleaner.modules.refinement-session.desc'),
      keys: ['refinement-session'],
    },
    {
      id: 'user-data',
      label: t('dataCleaner.modules.user-data.label'),
      description: t('dataCleaner.modules.user-data.desc'),
      keys: ['cep-auth', 'cep-tokens', 'cep-last-sync-sig'],
    },
    {
      id: 'cep-settings',
      label: t('dataCleaner.modules.cep-settings.label'),
      description: t('dataCleaner.modules.cep-settings.desc'),
      keys: ['cep-settings'],
    },
    {
      id: 'editor-drafts',
      label: t('dataCleaner.modules.editor-drafts.label'),
      description: t('dataCleaner.modules.editor-drafts.desc'),
      keys: ['cep-editor-drafts'],
    },
    {
      id: 'announcement-read',
      label: t('dataCleaner.modules.announcement-read.label'),
      description: t('dataCleaner.modules.announcement-read.desc'),
      keys: ['cep-announcement-read-ids'],
    },
  ]
}

function isKnownKey(key: string, modules: DataModule[]): boolean {
  for (const m of modules) {
    if (m.keys.includes(key)) return true
  }
  return false
}

interface UnknownEntry {
  key: string
  size: number
}

function getUnknownKeys(modules: DataModule[]): UnknownEntry[] {
  const result: UnknownEntry[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (isKnownKey(key, modules)) continue
      if (key.startsWith('announcement:skip:')) continue
      const val = localStorage.getItem(key)
      const size = val ? new Blob([val]).size : 0
      result.push({ key, size })
    }
  } catch { /* ignore */ }
  result.sort((a, b) => b.size - a.size)
  return result
}

// ─── 工具函数 ─────────────────────────────────────────────────

function getModuleSize(keys: string[]): number {
  let total = 0
  for (const key of keys) {
    try {
      const val = localStorage.getItem(key)
      if (val) total += new Blob([val]).size
    } catch { /* ignore */ }
  }
  return total
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ─── 子组件 ───────────────────────────────────────────────────

interface ModuleRowProps {
  label: string
  description: string
  size: number
  onClear: () => void
  loading: boolean
  badge?: string
}

function ModuleRow({ label, description, size, onClear, loading, badge }: ModuleRowProps) {
  const t = useTranslations()
  const exists = size > 0
  return (
    <div className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-neutral-50">
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-900 truncate">{label}</span>
          {badge && (
            <Badge variant="secondary" className="shrink-0 text-[11px] h-5 px-1.5">
              {badge}
            </Badge>
          )}
        </div>
        <span className="text-xs text-neutral-500 truncate">{description}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-neutral-400 tabular-nums w-14 text-right">
          {exists ? formatSize(size) : '—'}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!exists || loading}
          onClick={onClear}
          className="h-8 text-xs"
        >
          {t('dataCleaner.clear')}
        </Button>
      </div>
    </div>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────

export function DataCleaner() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastCleared, setLastCleared] = useState<string | null>(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [tick, setTick] = useState(0)

  const bump = useCallback(() => setTick(v => v + 1), [])

  const modules = useMemo(() => buildModules(t), [t])

  const unknownEntries = useMemo(
    () => getUnknownKeys(modules),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, tick, modules],
  )

  const totalSize = useMemo(() => {
    let sum = modules.reduce((s, m) => s + getModuleSize(m.keys), 0)
    for (const e of unknownEntries) sum += e.size
    return sum
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tick, modules, unknownEntries])

  const resetStoreForModule = useCallback((moduleId: string) => {
    switch (moduleId) {
      case 'essence-settings':
        useEssenceSettingsStore.getState().resetAllSettings()
        break
      case 'matrix-session':
        useMatrixStore.getState().clearWeapons()
        break
      case 'refinement-session':
        useRefinementStore.getState().selectEquip(null)
        break
      case 'user-data':
        // logout clears auth tokens and redirects — call only when explicitly clearing auth
        useAuthStore.getState().logout()
        break
    }
  }, [])

  const clearModule = useCallback((keys: string[]) => {
    for (const key of keys) {
      try { localStorage.removeItem(key) } catch { /* ignore */ }
    }
  }, [])

  const handleClearModule = useCallback((mod: DataModule) => {
    setLoading(true)
    try {
      resetStoreForModule(mod.id)
      clearModule(mod.keys)
      setLastCleared(mod.label)
      bump()
    } finally {
      setLoading(false)
    }
  }, [clearModule, bump, resetStoreForModule])

  const handleClearUnknownKey = useCallback((key: string) => {
    setLoading(true)
    try {
      localStorage.removeItem(key)
      setLastCleared(t('dataCleaner.clearedUnknown', { key }))
      bump()
    } finally {
      setLoading(false)
    }
  }, [bump, t])

  const handleClearAll = useCallback(() => {
    try {
      useEssenceSettingsStore.getState().resetAllSettings()
      useMatrixStore.getState().clearWeapons()
      useRefinementStore.getState().selectEquip(null)
      localStorage.clear()
      setLastCleared(t('dataCleaner.clearedAll'))
      setConfirmClearAll(false)
      bump()
    } catch { /* ignore */ }
  }, [bump, t])

  const activeCount = useMemo(
    () => modules.filter(m => getModuleSize(m.keys) > 0).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, modules],
  )

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" className="h-8 text-xs">
              {t('dataCleaner.clear')}
            </Button>
          }
        />
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('dataCleaner.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('dataCleaner.dialogDesc')}</DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[60vh]">
            <div className="space-y-6 px-1">
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-2">{t('dataCleaner.currentData')}</h4>
                <div className="divide-y divide-neutral-100 border rounded-lg">
                  {modules.map(mod => (
                    <ModuleRow
                      key={mod.id}
                      label={mod.label}
                      description={mod.description}
                      size={getModuleSize(mod.keys)}
                      onClear={() => handleClearModule(mod)}
                      loading={loading}
                    />
                  ))}
                </div>
              </div>

              {unknownEntries.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-neutral-700 mb-2">
                    {t('dataCleaner.unknownData')}
                    <Badge variant="secondary" className="ml-2 text-[11px] h-5 px-1.5 align-middle">
                      {unknownEntries.length}
                    </Badge>
                  </h4>
                  <div className="divide-y divide-neutral-100 border rounded-lg">
                    {unknownEntries.map(entry => (
                      <ModuleRow
                        key={entry.key}
                        label={entry.key}
                        description={t('dataCleaner.unknownKeyDesc')}
                        size={entry.size}
                        onClear={() => handleClearUnknownKey(entry.key)}
                        loading={loading}
                        badge={t('dataCleaner.unrecognized')}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">
              {t('dataCleaner.summary', { size: formatSize(totalSize), modules: activeCount, unknown: unknownEntries.length })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setConfirmClearAll(true)}
            >
              {t('dataCleaner.clearAll')}
            </Button>
          </div>
          {lastCleared && (
            <p className="text-xs text-neutral-400">{lastCleared}</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t('dataCleaner.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('dataCleaner.confirmDesc')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmClearAll(false)}>
              {t('dataCleaner.cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClearAll}>
              {t('dataCleaner.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
