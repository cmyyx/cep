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
    title: t('version.version'),
    description: t('meta.updateDescription'),
    keywords: t('meta.updateKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'update'),
    openGraph: {
      title: `${t('version.version')} - ${t('app.name')}`,
      description: t('meta.updateDescription'),
      images: [`/og/update/${locale}.png`],
    },
  }
}

export default function UpdateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
