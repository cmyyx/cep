'use client'

import { useState, useCallback, useMemo } from 'react'
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
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getIoModules, countItems, buildSummary, readModule } from '@/lib/data-io-utils'
import { versionData } from '@/generated/version-data'
import PreviewToggle from '@/components/shared/preview-toggle'

// ─── 工具 ─────────────────────────────────────────────────────

function downloadJson(data: Record<string, unknown>, filename: string) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── 主组件 ───────────────────────────────────────────────────

export function DataExporter() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

  const modules = useMemo(() => getIoModules(t), [t])

  const moduleEntries = useMemo(
    () =>
      modules.map((mod) => {
        const data = readModule(mod.key)
        const itemCount = countItems(mod.id, data)
        return {
          ...mod,
          data,
          itemCount,
          hasData: itemCount > 0,
          summary: buildSummary(mod.id, data, t),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, modules, t],
  )

  const [checked, setChecked] = useState<Set<string>>(new Set())
  const initChecked = useCallback(() => {
    setChecked(new Set(moduleEntries.filter((m) => m.hasData).map((m) => m.id)))
  }, [moduleEntries])

  const toggle = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => setChecked(new Set(moduleEntries.map((m) => m.id))), [moduleEntries])
  const deselectAll = useCallback(() => setChecked(new Set()), [])

  const handleOpen = useCallback((v: boolean) => {
    setOpen(v)
    if (v) initChecked()
  }, [initChecked])

  const handleExport = useCallback(() => {
    const moduleData: Record<string, unknown> = {}
    for (const entry of moduleEntries) {
      if (checked.has(entry.id) && entry.data !== null) {
        moduleData[entry.id] = entry.data
      }
    }
    const exportData: Record<string, unknown> = {
      version: 1,
      exportedAt: new Date().toISOString(),
      appVersion: versionData?.version ?? '0.0.0',
      device: {
        platform: (() => {
          if (typeof navigator === 'undefined') return 'unknown'
          const raw = navigator.platform ?? ''
          // 映射常见 legacy 值到可读名称
          if (raw.startsWith('Win')) return 'Windows'
          if (raw.startsWith('Mac')) return 'macOS'
          if (raw.startsWith('Linux')) return 'Linux'
          if (raw === 'iPhone' || raw === 'iPad') return 'iOS'
          if (raw === 'Android') return 'Android'
          return raw || 'unknown'
        })(),
        userAgent: typeof navigator !== 'undefined' ? (navigator.userAgent ?? '').slice(0, 200) : '',
      },
      modules: moduleData,
    }
    const dateStr = new Date().toISOString().slice(0, 10)
    downloadJson(exportData, `cep-data-export-${dateStr}.json`)
    setOpen(false)
  }, [checked, moduleEntries])

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleOpen(true)}>
        <Download className="size-3.5 mr-1.5" />
        {t('settings.exportData')}
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.exportTitle')}</DialogTitle>
            <DialogDescription>{t('settings.exportSelectModules')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-0.5">
            {moduleEntries.map((entry) => (
              <div key={entry.id}>
                <div
                  className={cn(
                    'flex items-center gap-2 px-1 py-2 hover:bg-neutral-50 rounded transition-colors flex-wrap select-none',
                    !entry.hasData && 'opacity-50',
                  )}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[role="checkbox"]')) return
                  }}
                >
                  <Checkbox
                    checked={checked.has(entry.id)}
                    onCheckedChange={() => toggle(entry.id)}
                    disabled={!entry.hasData}
                  />
                  <span className="flex-1 text-sm cursor-default">{entry.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0 cursor-pointer">{entry.summary}</span>
                  <PreviewToggle data={entry.data} />
                </div>
                </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
              {t('settings.selectAll')}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAll}>
              {t('settings.deselectAll')}
            </Button>
            <div className="flex-1" />
            <Button size="sm" onClick={handleExport} disabled={checked.size === 0}>
              {t('settings.exportSelected')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
