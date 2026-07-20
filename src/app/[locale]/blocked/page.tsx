'use client'

import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FullScreenStatus } from '@/components/shared/full-screen-status'
import { GuardFeedback } from '@/components/shared/guard-layout'
import { Button } from '@/components/ui/button'
import { FEATURES } from '@/lib/features'
import { DEFAULT_SITE_URL } from '@/lib/constants'
import { useBlockedPageGuard } from '@/hooks/use-blocked-page-guard'

export default function BlockedPage() {
  const t = useTranslations()
  useBlockedPageGuard()
  const domains = FEATURES.allowedDomains.length > 0
    ? FEATURES.allowedDomains
    : [new URL(DEFAULT_SITE_URL).hostname]
  const feedbackLinks = [
    { href: 'https://github.com/cmyyx/cep', label: t('feedback.github') },
    { href: 'https://end.302200.xyz', label: t('feedback.forum') },
    { href: 'https://qm.qq.com/q/Cjdo2aRikE', label: t('feedback.qqGroup') },
  ]

  return (
    <FullScreenStatus
      heading={t('blocked.title')}
      tone="destructive"
      role="alert"
      className="z-[110]"
      data-blocked-screen="true"
      description={(
        <>
          {t('blocked.description')}
          <br />
          <br />
          {t('blocked.notice')}
        </>
      )}
      actions={domains.map((domain, index) => (
        <Button
          key={domain}
          variant={index === 0 ? 'default' : 'outline'}
          nativeButton={false}
          className="w-full"
          render={<a href={`https://${domain}`} data-blocked-allow="true" />}
        >
          {domain}
          <ExternalLink data-icon="inline-end" />
        </Button>
      ))}
      footer={<GuardFeedback title={t('feedback.title')} links={feedbackLinks} />}
    />
  )
}
