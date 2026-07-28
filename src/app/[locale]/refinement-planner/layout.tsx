import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import { getAlternates } from '@/lib/metadata'
import { loadPlannerCatalogs, loadRouteShellMessages } from '@/i18n/load-messages'
import { RouteMessages } from '@/components/shared/route-messages'
import { PLANNER_GRID_TOOLTIP_OPEN_DELAY_MS, TooltipProvider } from '@/components/ui/tooltip'
import type { WikiLocale } from '@/types/wiki'

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

export default async function RefinementPlannerLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = {
    ...loadRouteShellMessages(locale as WikiLocale, 'refinement-planner'),
    ...loadPlannerCatalogs(locale as WikiLocale, 'refinement'),
  }
  return (
    <RouteMessages messages={messages}>
      <TooltipProvider delay={PLANNER_GRID_TOOLTIP_OPEN_DELAY_MS}>
        {children}
      </TooltipProvider>
    </RouteMessages>
  )
}
