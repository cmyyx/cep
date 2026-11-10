
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { WikiEntityGrid } from '@/components/wiki/wiki-entity-grid'
import { wikiEquipment } from '@/generated/data/wiki/equipment'
import { localizeWikiEntitySummaries } from '@/lib/wiki-summary-locale'
import { buildWikiEnumCatalog } from '@/lib/wiki-enum-catalog'
import { JsonLd } from '@/components/shared/json-ld'
import { getAlternates, parseKeywords } from '@/lib/metadata'
import { buildCollectionPageLd, pageUrl, wikiListBreadcrumbs } from '@/lib/wiki-structured-data'

const PATH = 'wiki/equipment'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  const title = t('meta.wikiEquipmentTitle')
  const description = t('meta.wikiEquipmentDescription')
  return {
    title,
    description,
    keywords: parseKeywords(t('meta.wikiEquipmentKeywords')),
    alternates: getAlternates(locale, PATH),
    openGraph: {
      title: `${title} - ${t('meta.wikiTitle')}`,
      description,
      images: [`/og/wiki/${locale}.png`],
    },
  }
}


export default async function WikiEquipmentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale })
  const { labels: enumLabels, order: enumOrder } = buildWikiEnumCatalog(
    ['equipmentParts'],
    (group, id) => t(`wikiData.enum|${group}|${id}`),
  )

  return (
    <>
      <JsonLd
        id="wiki-equipment"
        data={buildCollectionPageLd({
          locale,
          siteName: t('app.name'),
          name: t('meta.wikiEquipmentTitle'),
          description: t('meta.wikiEquipmentDescription'),
          path: PATH,
          items: wikiEquipment.map((entity) => ({
            name: t(`equips.${entity.id}`),
            url: pageUrl(locale, `${PATH}/${entity.id}`),
          })),
          breadcrumbs: wikiListBreadcrumbs(
            locale,
            t('nav.home'),
            t('wiki.categories.equipment'),
            PATH,
          ),
        })}
      />
      <div className="flex flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('wiki.categories.equipment')}
        </h1>
      </header>

      <WikiEntityGrid
        entities={localizeWikiEntitySummaries(wikiEquipment, locale, (entity) => t(`equips.${entity.id}`))}
        imageBasePath="/images/equip"
        enumLabels={enumLabels}
        enumOrder={enumOrder}
        filters={[
          { field: 'rarity', labelKey: 'wiki.filter.rarity' },
          { field: 'partTypeId', labelKey: 'wiki.filter.partType', enumGroup: 'equipmentParts' },
          // 精锻属性筛选: 仅 5★ 装备有数据, 标签复用 refinement 命名空间 (equipStats 前缀解析属性名)。
          { field: 'sub1', labelKey: 'refinement.subAttr1', labelPrefix: 'equipStats' },
          { field: 'sub2', labelKey: 'refinement.subAttr2', labelPrefix: 'equipStats' },
          { field: 'special', labelKey: 'refinement.specialEffect', labelPrefix: 'equipStats' },
        ]}
      />
      </div>
    </>
  )
}
