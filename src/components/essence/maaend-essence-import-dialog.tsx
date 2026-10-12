'use client'

import { useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Upload } from 'lucide-react'
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

type ImportError = MaaEndEssenceImportError | 'readError' | 'accountChanged'

interface ImportResult {
  report: EssenceImportReport
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
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<ImportError | null>(null)
  const [unknownErrors, setUnknownErrors] = useState<string[]>([])
  const accountName = useEssenceSettingsStore((state) => state.accounts.find((account) => account.id === state.activeAccountId)?.name ?? '')
  const customWeapons = useEssenceSettingsStore((state) => state.customWeapons)

  const changeOpen = (nextOpen: boolean) => {
    generation.current += 1
    setReading(false)
    setInputKey((key) => key + 1)
    setResult(null)
    setError(null)
    setUnknownErrors([])
    setOpen(nextOpen)
  }

  const importFile = async (file: File) => {
    const request = ++generation.current
    const accountId = useEssenceSettingsStore.getState().activeAccountId
    setReading(true)
    setResult(null)
    setError(null)
    setUnknownErrors([])
    const finish = () => {
      setReading(false)
      setInputKey((key) => key + 1)
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
    const report = useEssenceSettingsStore.getState().importEssenceMarks(accountId, parsed.weaponIds)
    if (!report) {
      setError('accountChanged')
      finish()
      return
    }
    setResult({ report, unknownWeaponIds: parsed.unknownWeaponIds, fileName: file.name, emptyScan: parsed.weaponIds.length === 0 })
    finish()
  }

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
  const sections = result ? [
    { key: 'added', label: t('maaendImport.added', { count: result.report.added.length }), ids: result.report.added, expanded: true },
    { key: 'consistent', label: t('maaendImport.consistent', { count: result.report.consistent.length }), ids: result.report.consistent, expanded: false },
    { key: 'retainedMissing', label: t('maaendImport.retainedMissing', { count: result.report.retainedMissing.length }), ids: result.report.retainedMissing, expanded: true, description: t('maaendImport.scanDifferenceHint') },
    { key: 'retainedCustom', label: t('maaendImport.retainedCustom', { count: result.report.retainedCustom.length }), ids: result.report.retainedCustom, expanded: false, description: t('maaendImport.customHint') },
    { key: 'unknown', label: t('maaendImport.unknown', { count: result.unknownWeaponIds.length }), ids: result.unknownWeaponIds, expanded: true },
  ] : []

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Button variant="ghost" size="icon-sm" aria-label={t('maaendImport.title')} title={t('maaendImport.title')} onClick={() => changeOpen(true)}>
        <Upload className="size-4" />
      </Button>
      <DialogContent showCloseButton={false} className={cn('max-h-[calc(100svh-2rem)] overflow-y-auto', 'sm:max-w-lg')}>
        <DialogHeader>
          <DialogTitle>{t('maaendImport.title')}</DialogTitle>
          <DialogDescription>{t('maaendImport.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="break-words text-sm font-medium">{t('maaendImport.account', { name: accountName })}</p>
          <Label htmlFor={inputId}>{t('maaendImport.fileLabel')}</Label>
          <Input
            key={inputKey}
            id={inputId}
            type="file"
            accept=".json,application/json"
            disabled={reading}
            className={cn('h-auto min-h-8 border-0 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]', 'file:max-w-full')}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) void importFile(file)
            }}
          />
        </div>
        {reading && <p role="status" className="text-sm text-muted-foreground">{t('maaendImport.reading')}</p>}
        {error && (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{errorMessages[error]}</p>
            {unknownErrors.length > 0 && <ul className="space-y-1 font-mono text-xs">{unknownErrors.map((id) => <li key={id} className="break-all">{id}</li>)}</ul>}
          </div>
        )}
        {result && (
          <div className="space-y-2">
            <p role="status" className="break-words text-sm font-medium">{t('maaendImport.success', { file: result.fileName, name: result.report.accountName })}</p>
            {result.emptyScan
              ? <p className="text-sm text-muted-foreground">{t('maaendImport.emptyScan')}</p>
              : result.report.added.length === 0 && <p className="text-sm text-muted-foreground">{t('maaendImport.noNewMarks')}</p>}
            {sections.map((section) => (
              <Collapsible key={section.key} defaultOpen={section.expanded && section.ids.length > 0} className="group rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
                <CollapsibleTrigger render={<Button variant="ghost" className={cn('h-auto w-full justify-between gap-2 p-2', 'whitespace-normal text-left')} />} disabled={section.ids.length === 0}>
                  <span>{section.label}</span>
                  <ChevronDown className="size-4 shrink-0 transition-transform group-data-open:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 px-2 pb-2">
                  {section.description && <p className="text-xs text-muted-foreground">{section.description}</p>}
                  <ul className="space-y-1 text-sm">{section.ids.map((id) => <li key={id} className="break-words">{section.key === 'unknown' ? id : weaponName(id)}</li>)}</ul>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
        <Button variant="outline" onClick={() => changeOpen(false)}>{t('common.close')}</Button>
      </DialogContent>
    </Dialog>
  )
}

export default MaaEndEssenceImportDialog
