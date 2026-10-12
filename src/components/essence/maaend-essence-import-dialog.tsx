'use client'

import { useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, RotateCcw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { parseMaaEndEssenceInventory, type MaaEndEssenceImportError } from '@/lib/maaend-essence-import'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { weapons } from '@/data/weapons'
import { cn } from '@/lib/utils'
import type { EssenceImportReport } from '@/types/essence-settings'
import { MaaEndEssenceWeaponRow } from './maaend-essence-weapon-row'

type ImportError = MaaEndEssenceImportError | 'readError' | 'accountChanged'

interface ImportResult {
  report: EssenceImportReport
  unknownWeaponIds: string[]
  fileName: string
  emptyScan: boolean
}

interface ImportPreview {
  accountId: string
  weaponIds: string[]
  selectedWeaponIds: string[]
  unknownWeaponIds: string[]
  fileName: string
  emptyScan: boolean
}

const builtInWeapons = new Map(weapons.map((weapon) => [weapon.id, weapon]))

export function MaaEndEssenceImportDialog() {
  const t = useTranslations()
  const inputId = useId()
  const generation = useRef(0)
  const [open, setOpen] = useState(false)
  const [reading, setReading] = useState(false)
  const [inputKey, setInputKey] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [error, setError] = useState<ImportError | null>(null)
  const [unknownErrors, setUnknownErrors] = useState<string[]>([])
  const accounts = useEssenceSettingsStore((state) => state.accounts)
  const activeAccountId = useEssenceSettingsStore((state) => state.activeAccountId)
  const accountName = accounts.find((account) => account.id === activeAccountId)?.name ?? ''
  const customWeapons = useEssenceSettingsStore((state) => state.customWeapons)

  const changeOpen = (nextOpen: boolean) => {
    generation.current += 1
    setReading(false)
    setInputKey((key) => key + 1)
    setSelectedFile(null)
    setResult(null)
    setPreview(null)
    setError(null)
    setUnknownErrors([])
    setOpen(nextOpen)
  }

  const previewFile = async (file: File) => {
    const request = ++generation.current
    const accountId = useEssenceSettingsStore.getState().activeAccountId
    setSelectedFile(file)
    setReading(true)
    setResult(null)
    setPreview(null)
    setError(null)
    setUnknownErrors([])
    const finish = () => {
      setReading(false)
    }

    let text: string
    try {
      text = await file.text()
    } catch {
      if (request === generation.current) {
        setError('readError')
        finish()
      }
      return
    }
    // Closing or reopening the dialog cancels a pending file read.
    if (request !== generation.current) return
    const parsed = parseMaaEndEssenceInventory(text)
    if (!parsed.ok) {
      setError(parsed.error)
      setUnknownErrors(parsed.unknownWeaponIds)
      finish()
      return
    }
    const report = useEssenceSettingsStore.getState().previewEssenceMarks(accountId, parsed.weaponIds)
    if (!report) {
      setError('accountChanged')
      finish()
      return
    }
    setPreview({ accountId, weaponIds: parsed.weaponIds, selectedWeaponIds: parsed.weaponIds, unknownWeaponIds: parsed.unknownWeaponIds, fileName: file.name, emptyScan: parsed.weaponIds.length === 0 })
    finish()
  }

  const confirmImport = () => {
    if (!preview || reading) return
    const report = useEssenceSettingsStore.getState().importEssenceMarks(preview.accountId, preview.selectedWeaponIds)
    if (!report) {
      setError('accountChanged')
      return
    }
    setResult({ report, unknownWeaponIds: preview.unknownWeaponIds, fileName: preview.fileName, emptyScan: preview.emptyScan })
    setPreview(null)
  }

  const previewReport = preview ? useEssenceSettingsStore.getState().previewEssenceMarks(preview.accountId, preview.weaponIds) : null
  const report = result?.report ?? previewReport
  const viewError = error ?? (preview && !previewReport ? 'accountChanged' : null)
  const unknownWeaponIds = result?.unknownWeaponIds ?? preview?.unknownWeaponIds ?? []
  const selectedCount = previewReport?.added.filter((id) => preview?.selectedWeaponIds.includes(id)).length ?? 0

  const weaponName = (id: string) => {
    const custom = customWeapons.find((weapon) => weapon.id === id)
    if (custom) return custom.name
    const weapon = builtInWeapons.get(id)
    if (!weapon) return id
    return id.startsWith('preview:') ? weapon.name : t(`weapons.${id}`)
  }

  const errorMessages: Record<ImportError, string> = {
    invalidJson: t('maaendImport.invalidJson'),
    invalidFormat: t('maaendImport.invalidFormat'),
    unknownOnly: t('maaendImport.unknownOnly'),
    readError: t('maaendImport.readError'),
    accountChanged: t('maaendImport.accountChanged'),
  }
  const sections = report ? [
    { key: 'added', label: preview ? t('maaendImport.pendingAdded', { count: selectedCount }) : t('maaendImport.added', { count: report.added.length }), ids: report.added, expanded: true },
    { key: 'consistent', label: t('maaendImport.consistent', { count: report.consistent.length }), ids: report.consistent, expanded: false },
    { key: 'retainedMissing', label: t('maaendImport.retainedMissing', { count: report.retainedMissing.length }), ids: report.retainedMissing, expanded: true, description: t('maaendImport.scanDifferenceHint') },
    { key: 'retainedCustom', label: t('maaendImport.retainedCustom', { count: report.retainedCustom.length }), ids: report.retainedCustom, expanded: false, description: t('maaendImport.customHint') },
    { key: 'unknown', label: t('maaendImport.unknown', { count: unknownWeaponIds.length }), ids: unknownWeaponIds, expanded: true },
  ] : []

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Button variant="ghost" size="icon-sm" aria-label={t('maaendImport.title')} title={t('maaendImport.title')} onClick={() => changeOpen(true)}>
        <Upload className="size-4" />
      </Button>
      <DialogContent showCloseButton={false} className={cn('flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden', 'sm:max-w-lg')}>
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('maaendImport.title')}</DialogTitle>
          <DialogDescription>{t('maaendImport.description')}</DialogDescription>
        </DialogHeader>
        <div className="shrink-0 space-y-2">
          <p className="break-words text-sm font-medium">{t('maaendImport.account', { name: accountName })}</p>
          <Label htmlFor={inputId}>{t('maaendImport.fileLabel')}</Label>
          <div className="flex items-center gap-2">
          <Input
            key={inputKey}
            id={inputId}
            type="file"
            accept=".json,application/json"
            disabled={reading}
            className={cn('h-auto min-h-8 border-0 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]', 'file:max-w-full')}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) void previewFile(file)
            }}
          />
          {selectedFile && <Button variant="ghost" size="icon-sm" disabled={reading} aria-label={t('maaendImport.repreview')} title={t('maaendImport.repreview')} onClick={() => void previewFile(selectedFile)}>
            <RotateCcw className="size-4" />
          </Button>}
          </div>
        </div>
        {(reading || viewError || report) && <div className="min-h-0 space-y-4 overflow-y-auto">
        {reading && <p role="status" className="text-sm text-muted-foreground">{t('maaendImport.reading')}</p>}
        {viewError && (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{errorMessages[viewError]}</p>
            {unknownErrors.length > 0 && <ul className="space-y-1 font-mono text-xs">{unknownErrors.map((id) => <li key={id} className="break-all">{id}</li>)}</ul>}
          </div>
        )}
        {report && (
          <div className="space-y-2">
            <p role="status" className="break-words text-sm font-medium">{result ? t('maaendImport.success', { file: result.fileName, name: report.accountName }) : t('maaendImport.preview', { file: preview!.fileName, name: report.accountName })}</p>
            {preview && <p className="text-sm text-muted-foreground">{t('maaendImport.selectionHint')}</p>}
            {(result?.emptyScan || preview?.emptyScan)
              ? <p className="text-sm text-muted-foreground">{t('maaendImport.emptyScan')}</p>
              : result && report.added.length === 0 && <p className="text-sm text-muted-foreground">{t('maaendImport.noNewMarks')}</p>}
            {sections.map((section) => (
              <Collapsible key={section.key} defaultOpen={section.expanded && section.ids.length > 0} className="group rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
                <CollapsibleTrigger render={<Button variant="ghost" className={cn('h-auto w-full justify-between gap-2 p-2', 'whitespace-normal text-left')} />} disabled={section.ids.length === 0}>
                  <span>{section.label}</span>
                  <ChevronDown className="size-4 shrink-0 transition-transform group-data-open:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 px-2 pb-2">
                  {section.description && <p className="text-xs text-muted-foreground">{section.description}</p>}
                  <ul className="space-y-2 text-sm">{section.ids.map((id) => (
                    <li key={id}>
                      <MaaEndEssenceWeaponRow
                        weapon={customWeapons.find((weapon) => weapon.id === id) ?? builtInWeapons.get(id)}
                        name={section.key === 'unknown' ? id : weaponName(id)}
                        checked={section.key === 'unknown' ? undefined : preview && section.key === 'added' ? preview.selectedWeaponIds.includes(id) : true}
                        onCheckedChange={preview && section.key === 'added' ? (checked) => setPreview((current) => current ? { ...current, selectedWeaponIds: checked ? [...current.selectedWeaponIds, id] : current.selectedWeaponIds.filter((selectedId) => selectedId !== id) } : null) : undefined}
                      />
                    </li>
                  ))}</ul>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
        </div>}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {preview && <span className="mr-auto text-sm text-muted-foreground">{t('maaendImport.selectedCount', { count: selectedCount })}</span>}
          <Button variant="outline" onClick={() => changeOpen(false)}>{t('common.close')}</Button>
          {preview && <Button disabled={reading || !previewReport || Boolean(viewError)} onClick={confirmImport}>{t('maaendImport.confirm')}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default MaaEndEssenceImportDialog
