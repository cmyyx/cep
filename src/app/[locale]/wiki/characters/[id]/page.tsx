import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { NavLink } from '@/components/shared/nav-link'
import { CharacterDetailContent, WikiDetailShell } from '@/components/wiki/wiki-detail-content'
import { wikiCharacters } from '@/generated/data/wiki/characters'
import { getCharacterWikiDetail } from '@/lib/wiki-data'
import type { WikiEnumGroup } from '@/types/wiki'
import { getAlternates } from '@/lib/metadata'


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
    title: `${t(`characters.${id}`)} - WIKI`,
    alternates: getAlternates(locale, `wiki/characters/${id}`),
  }
}

export default async function WikiCharacterDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const character = wikiCharacters.find((entry) => entry.id === id)
  const detail = getCharacterWikiDetail(id)
  if (!character || !detail) notFound()
  const t = await getTranslations({ locale })
  const name = t(`characters.${id}`)
  const label = (group: WikiEnumGroup, value: string) => t(`wikiData.enum|${group}|${value}`)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <NavLink href={`/${locale}/wiki/characters`} loadingLabel={t('wiki.categories.characters')} className="text-sm text-muted-foreground hover:text-foreground">
          {t('wiki.backTo', { category: t('wiki.categories.characters') })}
        </NavLink>
      </header>
      <WikiDetailShell tocItems={[
        { id: 'overview', label: t('wiki.overview') },
        { id: 'level-data', label: t('wiki.levelData') },
        ...(detail.attributeNodes.length > 0 ? [{ id: 'attribute-nodes', label: t('wiki.attributeNodes') }] : []),
        ...(detail.equipmentNodes.length > 0 ? [{ id: 'equipment-nodes', label: t('wikiData.ui|equipmentAdaptation') }] : []),
        { id: 'skills', label: t('wiki.skills') },
        { id: 'talents', label: t('wiki.talents') },
        { id: 'potentials', label: t('wiki.potentials') },
        { id: 'logistics-skills', label: t('wiki.logisticsSkills') },
        { id: 'promotions', label: t('wiki.promotions') },
      ]}>
        <CharacterDetailContent
          detail={detail}
          name={name}
          rarity={character.rarity}
          imageIds={detail.images}
          metaRows={[
            { label: t('wiki.element'), value: label('elements', character.elementId) },
            { label: t('wiki.profession'), value: label('professions', character.professionId) },
            { label: t('wiki.weaponType'), value: label('weaponTypes', character.weaponTypeId) },
            { label: t('wiki.mainAttribute'), value: label('attributes', character.mainAttributeId) },
            { label: t('wiki.subAttribute'), value: label('attributes', character.subAttributeId) },
          ]}
        />
      </WikiDetailShell>
    </div>
  )
}
