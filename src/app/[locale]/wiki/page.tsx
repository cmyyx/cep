import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shirt, Swords, UsersRound } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NavLink } from '@/components/shared/nav-link'
import { JsonLd } from '@/components/shared/json-ld'
import { wikiCharacters } from '@/generated/data/wiki/characters'
import { wikiWeapons } from '@/generated/data/wiki/weapons'
import { wikiEquipment } from '@/generated/data/wiki/equipment'
import { getAlternates, parseKeywords } from '@/lib/metadata'
import {
  buildCollectionPageLd,
  pageUrl,
  wikiListBreadcrumbs,
} from '@/lib/wiki-structured-data'
import { cn } from '@/lib/utils'

const PATH = 'wiki'

/**
 * WIKI 入口页。
 *
 * 存在的理由是搜索意图：「终末地wiki」这类查询在 Bing 上有一万多展现却只有
 * 0.6% 点击（以前的 /zh-CN/wiki 是 404，用户只能落到三个子列表之一）。这里
 * 给一个正面承接该意图的页面，同时把三个子列表和两个规划器串成一张内链网。
 */
const SECTIONS = [
  { href: '/wiki/characters', labelKey: 'wiki.categories.characters', descKey: 'wiki.hub.charactersDesc', count: wikiCharacters.length, Icon: UsersRound, accentClass: 'text-ship-red' },
  { href: '/wiki/weapons', labelKey: 'wiki.categories.weapons', descKey: 'wiki.hub.weaponsDesc', count: wikiWeapons.length, Icon: Swords, accentClass: 'text-preview-pink' },
  { href: '/wiki/equipment', labelKey: 'wiki.categories.equipment', descKey: 'wiki.hub.equipmentDesc', count: wikiEquipment.length, Icon: Shirt, accentClass: 'text-develop-blue' },
] as const

const RELATED_TOOLS = [
  { href: '/essence-planner', labelKey: 'nav.essencePlanner', descKey: 'about.essencePlannerDesc' },
  { href: '/refinement-planner', labelKey: 'nav.refinementPlanner', descKey: 'about.refinementPlannerDesc' },
] as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  const title = t('meta.wikiHubTitle')
  const description = t('meta.wikiHubDescription')
  return {
    title,
    description,
    keywords: parseKeywords(t('meta.wikiHubKeywords')),
    alternates: getAlternates(locale, PATH),
    openGraph: {
      title: `${title} - ${t('meta.wikiTitle')}`,
      description,
      images: [`/og/wiki/${locale}.png`],
    },
  }
}

export default async function WikiIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale })

  return (
    <>
      <JsonLd
        id="wiki-index"
        data={buildCollectionPageLd({
          locale,
          siteName: t('app.name'),
          name: t('meta.wikiHubTitle'),
          description: t('meta.wikiHubDescription'),
          path: PATH,
          items: SECTIONS.map(({ href, labelKey }) => ({
            name: t(labelKey),
            url: pageUrl(locale, href.slice(1)),
          })),
          breadcrumbs: wikiListBreadcrumbs(locale, t('nav.home'), t('wiki.hub.title'), PATH),
        })}
      />
      <div className="flex flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
          <SidebarTrigger />
          <h1 className="text-base font-semibold tracking-tight">{t('wiki.hub.title')}</h1>
        </header>

        <div className="md:flex-1 md:overflow-auto">
          <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t('wiki.hub.subtitle')}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SECTIONS.map(({ href, labelKey, descKey, count, Icon, accentClass }) => {
                const title = t(labelKey)
                return (
                  <NavLink key={href} href={`/${locale}${href}`} loadingLabel={title} className="block">
                    <Card className="h-full transition-shadow hover:ring-2 hover:ring-foreground/15">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Icon className={cn('size-4 shrink-0', accentClass)} aria-hidden="true" />
                          <span>{title}</span>
                        </CardTitle>
                        <CardDescription className="line-clamp-2">{t(descKey)}</CardDescription>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {t('wiki.hub.recordCount', { count })}
                        </p>
                      </CardHeader>
                    </Card>
                  </NavLink>
                )
              })}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold tracking-[-0.32px] text-foreground">
                {t('wiki.hub.relatedTools')}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {RELATED_TOOLS.map(({ href, labelKey, descKey }) => {
                  const title = t(labelKey)
                  return (
                    <NavLink key={href} href={`/${locale}${href}`} loadingLabel={title} className="block">
                      <Card size="sm" className="h-full transition-shadow hover:ring-2 hover:ring-foreground/15">
                        <CardHeader>
                          <CardTitle>{title}</CardTitle>
                          <CardDescription className="line-clamp-2">{t(descKey)}</CardDescription>
                        </CardHeader>
                      </Card>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
