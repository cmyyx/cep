
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { WikiEntityGrid } from '@/components/wiki/wiki-entity-grid'
import { wikiEquipment } from '@/generated/data/wiki/equipment'
import wikiEnums from '@/generated/data/wiki/enums.json'
import type { WikiEnumLabels } from '@/types/wiki'
import { getAlternates } from '@/lib/metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  return {
    title: `${t('wiki.categories.equipment')} - ${t('nav.wiki')}`,
    alternates: getAlternates(locale, 'wiki/equipment'),
  }
}


export default async function WikiEquipmentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('wiki.categories.equipment')}
        </h1>
      </header>

      <WikiEntityGrid
        entities={wikiEquipment}
        imageBasePath="/images/equip"
        enums={wikiEnums as WikiEnumLabels}
        filters={[
          { field: 'rarity', labelKey: 'wiki.filter.rarity' },
          { field: 'partTypeId', labelKey: 'wiki.filter.partType', enumGroup: 'equipmentParts' },
        ]}
      />
    </div>
  )
}
