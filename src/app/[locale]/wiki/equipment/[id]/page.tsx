import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ChevronLeft } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { buttonVariants } from '@/components/ui/button'
import { NavLink } from '@/components/shared/nav-link'
import { EquipmentDetailContent, WikiDetailShell, getEquipmentDetailSectionIds } from '@/components/wiki/wiki-detail-content'
import { WikiMaterialCatalogProvider } from '@/components/wiki/wiki-material-catalog'
import { wikiEquipment } from '@/generated/data/wiki/equipment'
import { getLocalizedEquipmentWikiDetail } from '@/lib/wiki-data'
import { getAlternates } from '@/lib/metadata'
import { JsonLd } from '@/components/shared/json-ld'
import { assetUrl, buildDetailPageLd, pageUrl } from '@/lib/wiki-structured-data'
import { cn } from '@/lib/utils'


export function generateStaticParams() {
  return wikiEquipment.map((equipment) => ({ id: equipment.id }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params
  const equipment = wikiEquipment.find((entry) => entry.id === id)
  if (!equipment) return { title: 'Not Found' }
  const t = await getTranslations({ locale })
  const name = t(`equips.${id}`)
  return {
    title: name,
    description: t('meta.wikiEquipmentDetailDescription', { name }),
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
    <>
      <JsonLd
        id={`wiki-equipment-${id}`}
        data={buildDetailPageLd({
          locale,
          siteName: t('app.name'),
          name,
          description: t('meta.wikiEquipmentDetailDescription', { name }),
          url: pageUrl(locale, `wiki/equipment/${id}`),
          image: assetUrl(`/images/equip/${equipment.imageId}.avif`),
          breadcrumbs: [
            { name: t('nav.home'), url: pageUrl(locale) },
            { name: t('wiki.categories.equipment'), url: pageUrl(locale, 'wiki/equipment') },
            { name, url: pageUrl(locale, `wiki/equipment/${id}`) },
          ],
        })}
      />
      <div className="flex flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <NavLink
          href={`/${locale}/wiki/equipment`}
          loadingLabel={t('wiki.categories.equipment')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')}
        >
          <ChevronLeft data-icon="inline-start" />
          {t('wiki.backTo', { category: t('wiki.categories.equipment') })}
        </NavLink>
        {/* 243 件装备长得都一样, 顶栏是唯一常驻的条目名。 */}
        <h1 className="min-w-0 truncate text-base font-semibold tracking-tight">{name}</h1>
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
    </>
  )
}
