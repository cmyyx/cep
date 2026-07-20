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
    title: 'WIKI',
    description: t('meta.wikiDescription'),
    keywords: t('meta.wikiKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    openGraph: {
      title: `WIKI - ${t('app.name')}`,
      description: t('meta.wikiDescription'),
      images: [`/og/wiki/${locale}.png`],
    },
  }
}

export default function WikiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
