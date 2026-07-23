import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { NavLink } from '@/components/shared/nav-link'
import { EquipmentDetailContent, WikiDetailShell } from '@/components/wiki/wiki-detail-content'
import { wikiEquipment } from '@/generated/data/wiki/equipment'
import { getEquipmentWikiDetail } from '@/lib/wiki-data'
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
    title: `${t(`equips.${id}`)} - WIKI`,
    alternates: getAlternates(locale, `wiki/equipment/${id}`),
  }
}

export default async function WikiEquipmentDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const equipment = wikiEquipment.find((entry) => entry.id === id)
  const detail = getEquipmentWikiDetail(id)
  if (!equipment || !detail) notFound()
  const t = await getTranslations({ locale })
  const name = t(`equips.${id}`)
  const part = t(`wikiData.enum|equipmentParts|${equipment.partTypeId}`)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <NavLink href={`/${locale}/wiki/equipment`} loadingLabel={t('wiki.categories.equipment')} className="text-sm text-muted-foreground hover:text-foreground">
          {t('wiki.backTo', { category: t('wiki.categories.equipment') })}
        </NavLink>
      </header>
      <WikiDetailShell tocItems={[
        { id: 'overview', label: t('wiki.overview') },
        { id: 'stats', label: t('wiki.stats') },
        { id: 'suit-effects', label: t('wiki.suitEffects') },
        { id: 'crafting-materials', label: t('wiki.craftingMaterials') },
      ]}>
        <EquipmentDetailContent
          detail={detail}
          name={name}
          rarity={equipment.rarity}
          imageId={equipment.imageId}
          meta={<><span>{t('wiki.partType')}: {part}</span><span>{t('wiki.minWearLv')}: {equipment.minimumLevel}</span>{equipment.suitId && <span>{t('wiki.suitId')}: {t(`wikiData.suit|${equipment.suitId}`)}</span>}</>}
        />
      </WikiDetailShell>
    </div>
  )
}
