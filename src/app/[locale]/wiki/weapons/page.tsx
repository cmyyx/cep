
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { WikiEntityGrid } from '@/components/wiki/wiki-entity-grid'
import { wikiWeapons } from '@/generated/data/wiki/weapons'
import { localizeWikiEntitySummaries } from '@/lib/wiki-summary-locale'
import { buildWikiEnumCatalog } from '@/lib/wiki-enum-catalog'
import { JsonLd } from '@/components/shared/json-ld'
import { getAlternates, parseKeywords } from '@/lib/metadata'
import { buildCollectionPageLd, pageUrl, wikiListBreadcrumbs } from '@/lib/wiki-structured-data'

const PATH = 'wiki/weapons'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  const title = t('meta.wikiWeaponsTitle')
  const description = t('meta.wikiWeaponsDescription')
  return {
    title,
    description,
    keywords: parseKeywords(t('meta.wikiWeaponsKeywords')),
    alternates: getAlternates(locale, PATH),
    openGraph: {
      title: `${title} - ${t('meta.wikiTitle')}`,
      description,
      images: [`/og/wiki/${locale}.png`],
    },
  }
}


export default async function WikiWeaponsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale })
  const { labels: enumLabels, order: enumOrder } = buildWikiEnumCatalog(
    ['weaponTypes'],
    (group, id) => t(`wikiData.enum|${group}|${id}`),
  )

  return (
    <>
      <JsonLd
        id="wiki-weapons"
        data={buildCollectionPageLd({
          locale,
          siteName: t('app.name'),
          name: t('meta.wikiWeaponsTitle'),
          description: t('meta.wikiWeaponsDescription'),
          path: PATH,
          items: wikiWeapons.map((entity) => ({
            name: t(`weapons.${entity.id}`),
            url: pageUrl(locale, `${PATH}/${entity.id}`),
          })),
          breadcrumbs: wikiListBreadcrumbs(
            locale,
            t('nav.home'),
            t('wiki.categories.weapons'),
            PATH,
          ),
        })}
      />
      <div className="flex flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('wiki.categories.weapons')}
        </h1>
      </header>

      <WikiEntityGrid
        entities={localizeWikiEntitySummaries(wikiWeapons, locale, (entity) => t(`weapons.${entity.id}`))}
        imageBasePath="/images/weapon"
        enumLabels={enumLabels}
        enumOrder={enumOrder}
        groupBy={{ field: 'weaponTypeId', enumGroup: 'weaponTypes' }}
        filters={[
          { field: 'rarity', labelKey: 'wiki.filter.rarity' },
          { field: 'weaponTypeId', labelKey: 'wiki.filter.weaponType', enumGroup: 'weaponTypes' },
          { field: 'acquisitionCategory', labelKey: 'wiki.filter.acquisitionCategory' },
        ]}
      />
      </div>
    </>
  )
}
