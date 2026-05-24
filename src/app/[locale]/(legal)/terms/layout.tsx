import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  return {
    title: t('legal.termsTitle'),
    description: t('meta.termsDescription'),
    openGraph: {
      title: `${t('legal.termsTitle')} - ${t('app.name')}`,
      description: t('meta.termsDescription'),
      images: [`/og/terms/${locale}.png`],
    },
  }
}

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
