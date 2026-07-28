import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ChevronLeft } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { buttonVariants } from '@/components/ui/button'
import { NavLink } from '@/components/shared/nav-link'
import { CharacterDetailContent, WikiDetailShell, getCharacterDetailSectionIds } from '@/components/wiki/wiki-detail-content'
import { WikiMaterialCatalogProvider } from '@/components/wiki/wiki-material-catalog'
import { wikiCharacters } from '@/generated/data/wiki/characters'
import { getLocalizedCharacterWikiDetail } from '@/lib/wiki-data'
import type { WikiEnumGroup } from '@/types/wiki'
import { getAlternates } from '@/lib/metadata'
import { cn } from '@/lib/utils'


export function generateStaticParams() {
  return wikiCharacters.map((character) => ({ id: character.id }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params
  const character = wikiCharacters.find((entry) => entry.id === id)
  if (!character) return { title: 'Not Found' }
  const t = await getTranslations({ locale })
  return {
    title: t(`characters.${id}`),
    alternates: getAlternates(locale, `wiki/characters/${id}`),
  }
}

export default async function WikiCharacterDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const character = wikiCharacters.find((entry) => entry.id === id)
  const pageData = getLocalizedCharacterWikiDetail(id, locale)
  if (!character || !pageData) notFound()
  const { detail, catalog } = pageData
  const t = await getTranslations({ locale })
  const name = t(`characters.${id}`)
  const label = (group: WikiEnumGroup, value: string) => t(`wikiData.enum|${group}|${value}`)
  // TOC entries must mirror the sections CharacterDetailContent actually renders.
  const sectionLabels: Record<string, string> = {
    overview: t('wiki.overview'),
    'level-data': t('wiki.levelData'),
    'attribute-nodes': t('wikiData.ui|attributeIncrease'),
    'equipment-nodes': t('wikiData.ui|equipmentAdaptation'),
    skills: t('wikiData.ui|operatorSkill'),
    talents: t('wikiData.ui|talent'),
    potentials: t('wikiData.ui|potential'),
    'logistics-skills': t('wikiData.ui|logisticsSkill'),
    promotions: t('wikiData.ui|promotion'),
  }
  const tocItems = getCharacterDetailSectionIds(detail).map((sectionId) => ({
    id: sectionId,
    label: sectionLabels[sectionId] ?? sectionId,
  }))

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <NavLink
          href={`/${locale}/wiki/characters`}
          loadingLabel={t('wiki.categories.characters')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')}
        >
          <ChevronLeft data-icon="inline-start" />
          {t('wiki.backTo', { category: t('wiki.categories.characters') })}
        </NavLink>
        {/* 详情页有 5000px+ 内容, 顶栏是唯一常驻的"当前是谁"。 */}
        <h1 className="min-w-0 truncate text-base font-semibold tracking-tight">{name}</h1>
      </header>
      <WikiMaterialCatalogProvider catalog={catalog}>
        <WikiDetailShell tocItems={tocItems}>
          <CharacterDetailContent
            detail={detail}
            name={name}
            rarity={character.rarity}
            imageIds={detail.images}
            metaRows={[
              { label: t('wiki.element'), value: label('elements', character.elementId) },
              { label: t('wiki.profession'), value: label('professions', character.professionId) },
              { label: t('wiki.weaponType'), value: label('weaponTypes', character.weaponTypeId) },
              { label: t('wikiData.ui|mainAttribute'), value: label('attributes', character.mainAttributeId) },
              { label: t('wikiData.ui|subAttribute'), value: label('attributes', character.subAttributeId) },
            ]}
          />
        </WikiDetailShell>
      </WikiMaterialCatalogProvider>
    </div>
  )
}
