
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { wikiCharacters } from '@/generated/data/wiki/characters'
import { localizeWikiEntitySummaries } from '@/lib/wiki-summary-locale'
import { buildWikiEnumCatalog } from '@/lib/wiki-enum-catalog'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { WikiEntityGrid } from '@/components/wiki/wiki-entity-grid'
import { JsonLd } from '@/components/shared/json-ld'
import { getAlternates, parseKeywords } from '@/lib/metadata'
import { buildCollectionPageLd, pageUrl, wikiListBreadcrumbs } from '@/lib/wiki-structured-data'

const PATH = 'wiki/characters'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  const title = t('meta.wikiCharactersTitle')
  const description = t('meta.wikiCharactersDescription')
  return {
    title,
    description,
    keywords: parseKeywords(t('meta.wikiCharactersKeywords')),
    alternates: getAlternates(locale, PATH),
    openGraph: {
      title: `${title} - ${t('meta.wikiTitle')}`,
      description,
      images: [`/og/wiki/${locale}.png`],
    },
  }
}


export default async function WikiCharactersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale })
  const { labels: enumLabels, order: enumOrder } = buildWikiEnumCatalog(
    ['elements', 'professions', 'weaponTypes'],
    (group, id) => t(`wikiData.enum|${group}|${id}`),
  )

  return (
    <>
      <JsonLd
        id="wiki-characters"
        data={buildCollectionPageLd({
          locale,
          siteName: t('app.name'),
          name: t('meta.wikiCharactersTitle'),
          description: t('meta.wikiCharactersDescription'),
          path: PATH,
          items: wikiCharacters.map((entity) => ({
            name: t(`characters.${entity.id}`),
            url: pageUrl(locale, `${PATH}/${entity.id}`),
          })),
          breadcrumbs: wikiListBreadcrumbs(
            locale,
            t('nav.home'),
            t('wiki.categories.characters'),
            PATH,
          ),
        })}
      />
      <div className="flex flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('wiki.categories.characters')}
        </h1>
      </header>

      <WikiEntityGrid
        entities={localizeWikiEntitySummaries(wikiCharacters, locale, (entity) => t(`characters.${entity.id}`))}
        imageBasePath="/images/characters"
        enumLabels={enumLabels}
        enumOrder={enumOrder}
        filters={[
          { field: 'rarity', labelKey: 'wiki.filter.rarity' },
          { field: 'elementId', labelKey: 'wiki.filter.element', enumGroup: 'elements' },
          { field: 'professionId', labelKey: 'wiki.filter.profession', enumGroup: 'professions' },
          { field: 'weaponTypeId', labelKey: 'wiki.filter.weaponType', enumGroup: 'weaponTypes' },
        ]}
      />
      </div>
    </>
  )
}
