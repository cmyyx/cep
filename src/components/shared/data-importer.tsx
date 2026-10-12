'use client'

import { useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDataImportStore } from '@/stores/useDataImportStore'
import { prepareImport, readJsonFile } from '@/lib/data-import'

/**
 * Import trigger for the settings page.
 *
 * The file is only read here; format detection and confirmation live in the
 * globally mounted DataImportDialog, which the drag & drop overlay also feeds.
 */
export function DataImporter() {
  const t = useTranslations()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const requestImport = useDataImportStore((s) => s.requestImport)
  const reportError = useDataImportStore((s) => s.reportError)

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.target
      const file = input.files?.[0]
      // Reset before the async read so picking the same file twice still fires.
      input.value = ''
      if (!file) return

      const result = await readJsonFile(file)
      if (!result.ok) {
        reportError(result.errorKey)
        return
      }
      requestImport(file.name, await prepareImport(result.json))
    },
    [requestImport, reportError],
  )

  return (
    <>
      <Input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        aria-label={t('settings.importData')}
        className="hidden"
        onChange={(event) => void handleFileSelect(event)}
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
    </>
  )
}
