'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Swords, Users, Wrench, Calendar } from 'lucide-react'
import { NavLink } from '@/components/shared/nav-link'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface OverviewCardData {
  href: string
  labelKey: string
  descKey: string
  Icon: typeof Swords
  accentClass: string
}

const CARDS: OverviewCardData[] = [
  {
    href: '/essence-planner',
    labelKey: 'nav.essencePlanner',
    descKey: 'about.essencePlannerDesc',
    Icon: Swords,
    accentClass: 'text-ship-red',
  },
  {
    href: '/banner-calendar',
    labelKey: 'nav.bannerCalendar',
    descKey: 'about.bannerCalendarDesc',
    Icon: Calendar,
    accentClass: 'text-develop-blue',
  },
  {
    href: '/refinement-planner',
    labelKey: 'nav.refinementPlanner',
    descKey: 'about.refinementPlannerDesc',
    Icon: Wrench,
    accentClass: 'text-preview-pink',
  },
  {
    href: '/character-guide',
    labelKey: 'nav.characterGuide',
    descKey: 'about.characterGuideDesc',
    Icon: Users,
    accentClass: 'text-muted-foreground',
  },
]

export function OverviewCards() {
  const t = useTranslations()
  const locale = useLocale()

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold tracking-[-0.32px] text-foreground">
        {t('home.quickLinks')}
      </h3>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {CARDS.map(({ href, labelKey, descKey, Icon, accentClass }) => {
          const fullHref = `/${locale}${href}`
          const title = t(labelKey)
          return (
            <NavLink
              key={href}
              href={fullHref}
              loadingLabel={title}
              className="block group/card"
            >
              <Card className="h-full transition-shadow hover:ring-2 hover:ring-foreground/15">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon
                      className={cn('size-4 shrink-0', accentClass)}
                      aria-hidden="true"
                    />
                    <span>{title}</span>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {t(descKey)}
                  </CardDescription>
                </CardHeader>
              </Card>
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
