import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { NavLink } from '@/components/shared/nav-link'
import { EquipmentDetailContent, WikiDetailShell, getEquipmentDetailSectionIds } from '@/components/wiki/wiki-detail-content'
import { WikiMaterialCatalogProvider } from '@/components/wiki/wiki-material-catalog'
import { wikiEquipment } from '@/generated/data/wiki/equipment'
import { getLocalizedEquipmentWikiDetail } from '@/lib/wiki-data'
import { getAlternates } from '@/lib/metadata'


export function generateStaticParams() {
  return wikiEquipment.map((equipment) => ({ id: equipment.id }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params
  const equipment = wikiEquipment.find((entry) => entry.id === id)
  if (!equipment) return { title: 'Not Found' }
  const t = await getTranslations({ locale })
  return {
    title: t(`equips.${id}`),
    alternates: getAlternates(locale, `wiki/equipment/${id}`),
  }
}

export default async function WikiEquipmentDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const equipment = wikiEquipment.find((entry) => entry.id === id)
  const pageData = getLocalizedEquipmentWikiDetail(id, locale)
  if (!equipment || !pageData) notFound()
  const { detail, catalog } = pageData
  const t = await getTranslations({ locale })
  const name = t(`equips.${id}`)
  const part = t(`wikiData.enum|equipmentParts|${equipment.partTypeId}`)
  // TOC entries must mirror the sections EquipmentDetailContent actually renders.
  const sectionLabels: Record<string, string> = {
    overview: t('wiki.overview'),
    stats: t('wiki.stats'),
    'suit-effects': t('wiki.suitEffects'),
    'crafting-materials': t('wiki.craftingMaterials'),
  }
  const tocItems = getEquipmentDetailSectionIds(detail).map((sectionId) => ({
    id: sectionId,
    label: sectionLabels[sectionId] ?? sectionId,
  }))

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <NavLink href={`/${locale}/wiki/equipment`} loadingLabel={t('wiki.categories.equipment')} className="text-sm text-muted-foreground hover:text-foreground">
          {t('wiki.backTo', { category: t('wiki.categories.equipment') })}
        </NavLink>
      </header>
      <WikiMaterialCatalogProvider catalog={catalog}>
        <WikiDetailShell tocItems={tocItems}>
          <EquipmentDetailContent
            detail={detail}
            name={name}
            rarity={equipment.rarity}
            imageId={equipment.imageId}
            meta={<><span>{t('wiki.partType')}: {part}</span><span>{t('wiki.minWearLv')}: {equipment.minimumLevel}</span>{equipment.suitId && <span>{t('wiki.suitId')}: {t(`wikiData.suit|${equipment.suitId}`)}</span>}</>}
          />
        </WikiDetailShell>
      </WikiMaterialCatalogProvider>
    </div>
  )
}
