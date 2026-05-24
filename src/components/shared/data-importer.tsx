'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Upload, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { useMatrixStore } from '@/stores/useMatrixStore'
import { useRefinementStore } from '@/stores/useRefinementStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { cn } from '@/lib/utils'
import {
  getIoModules,
  getKnownModuleIds,
  countItems,
  buildSummary,
  sanitizeObject,
  MAX_ITEMS_PER_MODULE,
} from '@/lib/data-io-utils'
import PreviewToggle from '@/components/shared/preview-toggle'

// ─── 类型 ─────────────────────────────────────────────────────

interface ImportFile {
  version: number
  exportedAt: string
  appVersion?: string
  device?: { platform?: string; userAgent?: string }
  modules: Record<string, unknown>
}

// ─── 校验 ─────────────────────────────────────────────────────

function validateImportFile(json: unknown): ImportFile | null {
  if (!json || typeof json !== 'object') return null
  const obj = json as Record<string, unknown>
  if (typeof obj.version !== 'number' || obj.version < 1) return null
  if (!obj.modules || typeof obj.modules !== 'object') return null
  return {
    version: obj.version,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
    appVersion: typeof obj.appVersion === 'string' ? obj.appVersion : undefined,
    device: obj.device && typeof obj.device === 'object'
      ? (obj.device as { platform?: string; userAgent?: string })
      : undefined,
    modules: obj.modules as Record<string, unknown>,
  }
}

// ─── 写入模块 ─────────────────────────────────────────────────

function importModule(moduleId: string, rawData: unknown) {
  const data = sanitizeObject(rawData)
  if (data === null || data === undefined || typeof data !== 'object') return

  switch (moduleId) {
    case 'essence-settings': {
      const payload = { state: data, version: 0 }
      localStorage.setItem('essence-settings', JSON.stringify(payload))
      const d = data as Record<string, unknown>
      useEssenceSettingsStore.setState({
        weaponOwnership: (d.weaponOwnership as Record<string, boolean>) ?? {},
        essenceStatus: (d.essenceStatus as Record<string, boolean>) ?? {},
        weaponNotes: (d.weaponNotes as Record<string, string>) ?? {},
        customWeapons: Array.isArray(d.customWeapons) ? d.customWeapons : [],
        ...(d.flags && typeof d.flags === 'object' ? d.flags : {}),
        regionFirst: (d.regionFirst as string) ?? null,
        regionSecond: (d.regionSecond as string) ?? null,
      })
      break
    }
    case 'matrix-session': {
      const payload = { state: data, version: 0 }
      localStorage.setItem('matrix-session', JSON.stringify(payload))
      const d = data as Record<string, unknown>
      useMatrixStore.setState({
        selectedWeaponIds: (Array.isArray(d.selectedWeaponIds) ? d.selectedWeaponIds : []) as string[],
        dungeonS1Selections: (d.dungeonS1Selections ?? {}) as Record<string, string[]>,
        expandedPlanKeys: (Array.isArray(d.expandedPlanKeys) ? d.expandedPlanKeys : []) as string[],
        selectedRegions: (Array.isArray(d.selectedRegions) ? d.selectedRegions : []) as string[],
        selectedSubRegions: (Array.isArray(d.selectedSubRegions) ? d.selectedSubRegions : []) as string[],
        plansStale: true,
      })
      useMatrixStore.getState().computePlans()
      break
    }
    case 'refinement-session': {
      const payload = { state: data, version: 0 }
      localStorage.setItem('refinement-session', JSON.stringify(payload))
      const d = data as Record<string, unknown>
      useRefinementStore.setState({
        selectedEquipId: (d.selectedEquipId as string) ?? null,
        collapsedSets: (d.collapsedSets as Record<string, boolean>) ?? {},
        filterSub1: (Array.isArray(d.filterSub1) ? d.filterSub1 : []) as string[],
        filterSub2: (Array.isArray(d.filterSub2) ? d.filterSub2 : []) as string[],
        filterSpecial: (Array.isArray(d.filterSpecial) ? d.filterSpecial : []) as string[],
        filterCollapsed: (d.filterCollapsed as boolean) ?? true,
        filterMaterial: (Array.isArray(d.filterMaterial) ? d.filterMaterial : []) as string[],
        expandedRecommendations: (d.expandedRecommendations as Record<string, boolean>) ?? {},
      })
      break
    }
    case 'cep-settings': {
      localStorage.setItem('cep-settings', JSON.stringify(data))
      useSettingsStore.getState().hydrateFromStorage()
      break
    }
    case 'editor-drafts': {
      const payload = { state: data, version: 0 }
      localStorage.setItem('cep-editor-drafts', JSON.stringify(payload))
      break
    }
    case 'announcement-read': {
      const payload = { state: data, version: 0 }
      localStorage.setItem('cep-announcement-read-ids', JSON.stringify(payload))
      break
    }
  }
}

// ─── 主组件 ───────────────────────────────────────────────────

export function DataImporter() {
  const t = useTranslations()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [file, setFile] = useState<ImportFile | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const modules = useMemo(() => getIoModules(t), [t])
  const knownIds = useMemo(() => getKnownModuleIds(t), [t])

  const [checked, setChecked] = useState<Set<string>>(new Set())

  const summaries = useMemo(() => {
    if (!file) return []
    return modules.map((mod) => {
      const data = file.modules[mod.id]
      const itemCount = countItems(mod.id, data)
      const safe = itemCount <= (MAX_ITEMS_PER_MODULE[mod.id] ?? 10000)
      return {
        id: mod.id,
        label: mod.label,
        data,
        itemCount,
        hasData: itemCount > 0,
        withinLimit: safe,
        summary: buildSummary(mod.id, data, t),
      }
    })
  }, [file, modules, t])

  const hasAnyChecked = checked.size > 0

  const toggle = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (file) {
      const ids = summaries.filter((s) => s.hasData && s.withinLimit).map((s) => s.id)
      setChecked(new Set(ids))
    }
  }, [file, summaries])

  const deselectAll = useCallback(() => setChecked(new Set()), [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (!f) return

      setError(null)
      setFileName(f.name)

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result as string)
          const parsed = validateImportFile(json)
          if (!parsed) {
            setError(t('settings.importInvalidFormat'))
            return
          }
          setFile(parsed)
          // 默认选中「模块在白名单中 + 有数据 + 未超上限」的模块
          const ids = modules
            .filter((m) => {
              if (!knownIds.has(m.id)) return false
              const d = parsed.modules[m.id]
              if (countItems(m.id, d) === 0) return false
              const max = MAX_ITEMS_PER_MODULE[m.id] ?? 10000
              return countItems(m.id, d) <= max
            })
            .map((m) => m.id)
          setChecked(new Set(ids))
          setDialogOpen(true)
        } catch {
          setError(t('settings.importParseError'))
        }
      }
      reader.onerror = () => {
        setError(t('settings.importReadError'))
      }
      reader.readAsText(f)

      e.target.value = ''
    },
    [t, modules, knownIds],
  )

  const handleImport = useCallback(() => {
    if (!file) return
    for (const mod of modules) {
      if (!checked.has(mod.id)) continue
      if (!knownIds.has(mod.id)) continue
      const rawData = file.modules[mod.id]
      if (rawData === null || rawData === undefined) continue
      const max = MAX_ITEMS_PER_MODULE[mod.id] ?? 10000
      if (countItems(mod.id, rawData) > max) continue
      importModule(mod.id, rawData)
    }
    setImported(true)
    setDialogOpen(false)
    setFile(null)
  }, [file, modules, checked, knownIds])

  const handleClose = useCallback(() => {
    setDialogOpen(false)
    setFile(null)
    setError(null)
    if (imported) setImported(false)
  }, [imported])

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="size-3.5 mr-1.5" />
        {t('settings.importData')}
      </Button>

      {error && (
        <div className="fixed bottom-6 right-6 z-[60] max-w-sm rounded-lg bg-background px-4 py-3 text-sm shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),0px_2px_2px_rgba(0,0,0,0.04),0px_8px_8px_-8px_rgba(0,0,0,0.04)]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-red-500" />
            <span className="flex-1 text-sm">{error}</span>
            <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" onClick={() => setError(null)}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {imported && (
        <div className="fixed bottom-6 right-6 z-[60] max-w-sm rounded-lg bg-background px-4 py-3 text-sm shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),0px_2px_2px_rgba(0,0,0,0.04),0px_8px_8px_-8px_rgba(0,0,0,0.04)] animate-toast-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-green-500" />
            <span className="flex-1 text-sm">{t('settings.importSuccess')}</span>
            <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" onClick={() => setImported(false)}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.importTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.importDesc', { file: fileName })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground space-y-0.5">
              {file?.exportedAt && (
                <p>{t('settings.importExportedAt')}: {new Date(file.exportedAt).toLocaleString()}</p>
              )}
              {file?.appVersion && (
                <p>{t('settings.importExportedBy')}: {file.appVersion}</p>
              )}
              {file?.device?.platform && (
                <p>{t('settings.importDevice')}: {file.device.platform}</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">{t('settings.importSelectModules')}</p>

            <div className="space-y-0.5">
              {summaries.map((s) => (
                <div key={s.id}>
                  <div
                    className={cn(
                      'flex items-center gap-2 px-1 py-2 hover:bg-neutral-50 rounded transition-colors flex-wrap select-none',
                      (!s.hasData || !s.withinLimit) && 'opacity-50',
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('[role="checkbox"]')) return
                    }}
                  >
                    <Checkbox
                      checked={checked.has(s.id)}
                      onCheckedChange={() => toggle(s.id)}
                      disabled={!s.hasData || !s.withinLimit}
                    />
                    <span className="flex-1 text-sm cursor-default">{s.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 cursor-pointer">
                      {!s.withinLimit ? '⚠ ' : ''}{s.summary}
                    </span>
                    <PreviewToggle data={s.data} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
              {t('settings.selectAll')}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAll}>
              {t('settings.deselectAll')}
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleClose}>
              {t('settings.cancel')}
            </Button>
            <Button size="sm" onClick={handleImport} disabled={!hasAnyChecked}>
              {t('settings.importConfirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
