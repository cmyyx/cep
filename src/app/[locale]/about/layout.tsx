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
    title: t('nav.about'),
    description: t('meta.aboutDescription'),
    openGraph: {
      title: `${t('nav.about')} - ${t('app.name')}`,
      description: t('meta.aboutDescription'),
      images: [`/og/about/${locale}.png`],
    },
  }
}

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
