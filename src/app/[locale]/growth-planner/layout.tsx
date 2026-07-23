import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { getAlternates } from '@/lib/metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  return {
    title: t('nav.growthPlanner'),
    description: t('meta.growthPlannerDescription'),
    keywords: t('meta.growthPlannerKeywords').split(',').map((key) => key.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'growth-planner'),
  }
}

export default function GrowthPlannerLayout({ children }: { children: React.ReactNode }) {
  return children
}
