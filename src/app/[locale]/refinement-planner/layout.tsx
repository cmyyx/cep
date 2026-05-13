import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  try {
    const t = await getTranslations({ locale })
    return { title: t('nav.refinementPlanner') }
  } catch {
    // Fall back to default locale if the requested locale fails
    const t = await getTranslations({ locale: routing.defaultLocale })
    return { title: t('nav.refinementPlanner') }
  }
}

export default function RefinementPlannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
