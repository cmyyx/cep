import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import { getAlternates } from '@/lib/metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  try {
    const t = await getTranslations({ locale })
    return {
      title: t('nav.refinementPlanner'),
      description: t('meta.refinementPlannerDescription'),
      keywords: t('meta.refinementPlannerKeywords').split(',').map((k) => k.trim()).filter(Boolean),
      alternates: getAlternates(locale, 'refinement-planner'),
      openGraph: {
        title: `${t('nav.refinementPlanner')} - ${t('app.name')}`,
        description: t('meta.refinementPlannerDescription'),
        images: [`/og/refinement-planner/${locale}.png`],
      },
    }
  } catch {
    // Fall back to default locale if the requested locale fails
    const fallbackLocale = routing.defaultLocale
    const t = await getTranslations({ locale: fallbackLocale })
    return {
      title: t('nav.refinementPlanner'),
      description: t('meta.refinementPlannerDescription'),
      keywords: t('meta.refinementPlannerKeywords').split(',').map((k) => k.trim()).filter(Boolean),
      alternates: getAlternates(fallbackLocale, 'refinement-planner'),
      openGraph: {
        title: `${t('nav.refinementPlanner')} - ${t('app.name')}`,
        description: t('meta.refinementPlannerDescription'),
        images: [`/og/refinement-planner/${fallbackLocale}.png`],
      },
    }
  }
}

export default function RefinementPlannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
