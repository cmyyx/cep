
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { wikiCharacters } from '@/generated/data/wiki/characters'
import { localizeWikiEntitySummaries } from '@/lib/wiki-summary-locale'
import { buildWikiEnumCatalog } from '@/lib/wiki-enum-catalog'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { WikiEntityGrid } from '@/components/wiki/wiki-entity-grid'
import { getAlternates } from '@/lib/metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  return {
    title: t('wiki.categories.characters'),
    alternates: getAlternates(locale, 'wiki/characters'),
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('wiki.categories.characters')}
        </h1>
      </header>

      <WikiEntityGrid
        entities={localizeWikiEntitySummaries(wikiCharacters, locale)}
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
  )
}
