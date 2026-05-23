'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  hasLegacyStorage,
  migrateLegacyStorage,
  clearLegacyStorage,
} from '@/lib/migrate-legacy-storage'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'

export function LegacyMigrationDialog() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) return
    if (typeof window === 'undefined') return

    const timer = setTimeout(() => {
      if (hasLegacyStorage()) setOpen(true)
      setDone(true)
    }, 400)

    return () => clearTimeout(timer)
  }, [done])

  // ─── 迁移 ───
  const [migrateStep, setMigrateStep] = useState<'idle' | 'confirm' | 'done'>('idle')
  const [migrateCountdown, setMigrateCountdown] = useState(3)

  const resetMigrate = useCallback(() => {
    setMigrateStep('idle')
    setMigrateCountdown(3)
  }, [])

  const handleMigrateFirst = useCallback(() => {
    setMigrateStep('confirm')
    setMigrateCountdown(3)
  }, [])

  useEffect(() => {
    if (migrateStep !== 'confirm' || migrateCountdown <= 0) return
    const timer = setInterval(() => {
      setMigrateCountdown(c => {
        if (c <= 1) { clearInterval(timer); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [migrateStep, migrateCountdown])

  const handleMigrateConfirm = useCallback(() => {
    if (migrateCountdown > 0) return
    const result = migrateLegacyStorage()
    clearLegacyStorage()
    // 直接更新 Zustand store，无需刷新页面
    if (result?.data) {
      const store = useEssenceSettingsStore.getState()
      useEssenceSettingsStore.setState({
        weaponOwnership: { ...result.data.weaponOwnership, ...store.weaponOwnership },
        essenceStatus: { ...result.data.essenceStatus, ...store.essenceStatus },
        weaponNotes: { ...result.data.weaponNotes, ...store.weaponNotes },
      })
    }
    setMigrateStep('done')
  }, [migrateCountdown])

  // ─── 丢弃 ───
  const [discardStep, setDiscardStep] = useState<'idle' | 'confirm' | 'done'>('idle')
  const [discardCountdown, setDiscardCountdown] = useState(3)

  const resetDiscard = useCallback(() => {
    setDiscardStep('idle')
    setDiscardCountdown(3)
  }, [])

  const handleDiscardFirst = useCallback(() => {
    setDiscardStep('confirm')
    setDiscardCountdown(3)
  }, [])

  useEffect(() => {
    if (discardStep !== 'confirm' || discardCountdown <= 0) return
    const timer = setInterval(() => {
      setDiscardCountdown(c => {
        if (c <= 1) { clearInterval(timer); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [discardStep, discardCountdown])

  const handleDiscardConfirm = useCallback(() => {
    if (discardCountdown > 0) return
    clearLegacyStorage()
    setDiscardStep('done')
  }, [discardCountdown])

  // ─── 操作完成后自动关闭弹窗 ───
  useEffect(() => {
    if (migrateStep === 'done' || discardStep === 'done') {
      const timer = setTimeout(() => setOpen(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [migrateStep, discardStep])

  if (!open) return null

  return (
    <Dialog open={open} disablePointerDismissal onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('legacyMigration.title')}</DialogTitle>
          <DialogDescription>{t('legacyMigration.description')}</DialogDescription>
        </DialogHeader>

        <div className="text-sm text-neutral-600 space-y-3">
          <p>{t('legacyMigration.body')}</p>

          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <p className="font-medium text-neutral-800">{t('legacyMigration.migrateLabel')}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{t('legacyMigration.migrateDesc')}</p>
            </div>

            {migrateStep === 'idle' && (
              <Button size="sm" className="w-full" onClick={handleMigrateFirst}>
                {t('legacyMigration.migrateLabel')}
              </Button>
            )}

            {migrateStep === 'confirm' && (
              <div className="space-y-2">
                <p className="text-xs text-amber-600">{t('legacyMigration.migrateConfirm')}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetMigrate}>
                    {t('legacyMigration.cancel')}
                  </Button>
                  <Button size="sm" disabled={migrateCountdown > 0} onClick={handleMigrateConfirm} className="flex-1">
                    {migrateCountdown > 0
                      ? t('legacyMigration.migrateCountdown', { count: migrateCountdown })
                      : t('legacyMigration.migrateButton')}
                  </Button>
                </div>
              </div>
            )}

            {migrateStep === 'done' && (
              <p className="text-xs text-green-600">{t('legacyMigration.migrateDone')}</p>
            )}
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <p className="font-medium text-neutral-800">{t('legacyMigration.discardLabel')}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{t('legacyMigration.discardDesc')}</p>
            </div>

            {discardStep === 'idle' && (
              <Button variant="outline" size="sm" className="w-full" onClick={handleDiscardFirst}>
                {t('legacyMigration.discardLabel')}
              </Button>
            )}

            {discardStep === 'confirm' && (
              <div className="space-y-2">
                <p className="text-xs text-red-600">{t('legacyMigration.discardConfirm')}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetDiscard}>
                    {t('legacyMigration.cancel')}
                  </Button>
                  <Button variant="destructive" size="sm" disabled={discardCountdown > 0} onClick={handleDiscardConfirm} className="flex-1">
                    {discardCountdown > 0
                      ? t('legacyMigration.discardCountdown', { count: discardCountdown })
                      : t('legacyMigration.discardButton')}
                  </Button>
                </div>
              </div>
            )}

            {discardStep === 'done' && (
              <p className="text-xs text-green-600">{t('legacyMigration.discardDone')}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
