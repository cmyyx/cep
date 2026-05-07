'use client'

import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useVersion } from '@/hooks/use-version'

export function ForceUpgradeDialog() {
  const t = useTranslations()
  const { refreshPage } = useVersion()

  return (
    <Dialog open modal disablePointerDismissal>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('version.forceUpgradeTitle')}</DialogTitle>
          <DialogDescription>
            {t('version.forceUpgradeMessage')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={refreshPage} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('version.forceUpgradeButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
