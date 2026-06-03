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
    title: t('nav.essencePlanner'),
    description: t('meta.essencePlannerDescription'),
    keywords: t('meta.essencePlannerKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'essence-planner'),
    openGraph: {
      title: `${t('nav.essencePlanner')} - ${t('app.name')}`,
      description: t('meta.essencePlannerDescription'),
      images: [`/og/essence-planner/${locale}.png`],
    },
  }
}

export default function EssencePlannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
