
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { WikiEntityGrid } from '@/components/wiki/wiki-entity-grid'
import { wikiEquipment } from '@/generated/data/wiki/equipment'
import { localizeWikiEntitySummaries } from '@/lib/wiki-summary-locale'
import { buildWikiEnumCatalog } from '@/lib/wiki-enum-catalog'
import { getAlternates } from '@/lib/metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  return {
    title: t('wiki.categories.equipment'),
    alternates: getAlternates(locale, 'wiki/equipment'),
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('wiki.categories.equipment')}
        </h1>
      </header>

      <WikiEntityGrid
        entities={localizeWikiEntitySummaries(wikiEquipment, locale)}
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
  )
}
