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
    title: t('nav.backgroundPreview'),
    description: t('meta.backgroundPreviewDescription'),
    openGraph: {
      title: `${t('nav.backgroundPreview')} - ${t('app.name')}`,
      description: t('meta.backgroundPreviewDescription'),
      images: [`/og/background-preview/${locale}.png`],
    },
  }
}

export default function BackgroundPreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
