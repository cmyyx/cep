import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

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
    return { title: 'Refinement Planner' }
  }
}

export default function RefinementPlannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
