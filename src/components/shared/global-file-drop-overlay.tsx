'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Upload } from 'lucide-react'
import { useDataImportStore } from '@/stores/useDataImportStore'
import { prepareImport, readJsonFile } from '@/lib/data-import'

/** Elements that own their own drop handling (text editing). */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.closest('input, textarea, [contenteditable=""], [contenteditable="true"]') !== null
}

/** Only real file drags should trigger the overlay (not text/element drags). */
function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

/**
 * App-wide "drop a JSON file anywhere to import" overlay.
 *
 * Mounted once in the locale layout. Drops are only intercepted for files
 * outside editable elements, so dragging text into inputs keeps working.
 */
export function GlobalFileDropOverlay() {
  const t = useTranslations()
  const [dragging, setDragging] = useState(false)
  // dragenter/dragleave fire for every nested element — count depth so moving
  // the cursor over children does not hide the overlay.
  const depthRef = useRef(0)
  const requestImport = useDataImportStore((s) => s.requestImport)
  const reportError = useDataImportStore((s) => s.reportError)

  const handleFile = useCallback(
    async (file: File) => {
      if (!/\.json$/i.test(file.name)) {
        reportError('settings.importUnsupportedFile')
        return
      }
      const result = await readJsonFile(file)
      if (!result.ok) {
        reportError(result.errorKey)
        return
      }
      requestImport(file.name, await prepareImport(result.json))
    },
    [requestImport, reportError],
  )

  useEffect(() => {
    const reset = () => {
      depthRef.current = 0
      setDragging(false)
    }

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event) || isEditableTarget(event.target)) return
      depthRef.current += 1
      setDragging(true)
    }

    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event) || isEditableTarget(event.target)) return
      // preventDefault on dragover is what allows the drop event to fire at all
      // (and stops the browser from navigating to the file).
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      setDragging(true)
    }

    const onDragLeave = () => {
      // No hasFiles() gate: browsers may report an empty types list while
      // leaving the window, which would otherwise strand the overlay visible.
      depthRef.current = Math.max(0, depthRef.current - 1)
      if (depthRef.current === 0) setDragging(false)
    }

    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      const editable = isEditableTarget(event.target)
      reset()
      if (editable) return
      event.preventDefault()
      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      void handleFile(file)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [handleFile])

  if (!dragging) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div className="relative flex flex-col items-center gap-2 rounded-xl bg-popover px-10 py-8 text-center shadow-[var(--shadow-card)] ring-1 ring-foreground/10">
        <Upload className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">{t('settings.importDropTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('settings.importDropDesc')}</p>
      </div>
    </div>
  )
}
