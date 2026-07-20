'use client'

import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BlockingNoticeDialog } from '@/components/shared/blocking-notice-dialog'
import { useVersion } from '@/hooks/use-version'

export function ForceUpgradeDialog() {
  const t = useTranslations()
  const { refreshPage } = useVersion()

  return (
    <BlockingNoticeDialog
      title={t('version.forceUpgradeTitle')}
      description={t('version.forceUpgradeMessage')}
    >
      <Button onClick={refreshPage} className="w-full">
        <RefreshCw data-icon="inline-start" />
        {t('version.forceUpgradeButton')}
      </Button>
    </BlockingNoticeDialog>
  )
}
