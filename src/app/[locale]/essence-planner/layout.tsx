import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
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

export default async function EssencePlannerLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = {
    ...loadRouteShellMessages(locale as WikiLocale, 'essence-planner'),
    ...loadPlannerCatalogs(locale as WikiLocale, 'essence'),
  }
  return (
    <RouteMessages messages={messages}>
      <TooltipProvider delay={PLANNER_GRID_TOOLTIP_OPEN_DELAY_MS}>
        {children}
      </TooltipProvider>
    </RouteMessages>
  )
}
