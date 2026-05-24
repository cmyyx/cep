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
    title: t('legal.privacyTitle'),
    description: t('meta.privacyDescription'),
    openGraph: {
      title: `${t('legal.privacyTitle')} - ${t('app.name')}`,
      description: t('meta.privacyDescription'),
      images: [`/og/privacy/${locale}.png`],
    },
  }
}

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
