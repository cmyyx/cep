import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { getAlternates } from '@/lib/metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  return {
    title: t('account.title'),
    description: t('meta.accountDescription'),
    keywords: t('meta.accountKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'account'),
    openGraph: {
      title: `${t('account.title')} - ${t('app.name')}`,
      description: t('meta.accountDescription'),
      images: [`/og/account/${locale}.png`],
    },
  }
}

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
