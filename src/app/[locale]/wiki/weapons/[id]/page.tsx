import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ChevronLeft } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { buttonVariants } from '@/components/ui/button'
import { NavLink } from '@/components/shared/nav-link'
import { WeaponDetailContent, WikiDetailShell } from '@/components/wiki/wiki-detail-content'
import { WikiMaterialCatalogProvider } from '@/components/wiki/wiki-material-catalog'
import { wikiWeapons } from '@/generated/data/wiki/weapons'
import { getLocalizedWeaponWikiDetail } from '@/lib/wiki-data'
import { getAlternates } from '@/lib/metadata'
import { cn } from '@/lib/utils'


export function generateStaticParams() {
  return wikiWeapons.map((weapon) => ({ id: weapon.id }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params
  const weapon = wikiWeapons.find((entry) => entry.id === id)
  if (!weapon) return { title: 'Not Found' }
  const t = await getTranslations({ locale })
  return {
    title: t(`weapons.${id}`),
    alternates: getAlternates(locale, `wiki/weapons/${id}`),
  }
}

export default async function WikiWeaponDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const weapon = wikiWeapons.find((entry) => entry.id === id)
  const pageData = getLocalizedWeaponWikiDetail(id, locale)
  if (!weapon || !pageData) notFound()
  const { detail, catalog } = pageData
  const t = await getTranslations({ locale })
  const name = t(`weapons.${id}`)
  const weaponType = t(`wikiData.enum|weaponTypes|${weapon.weaponTypeId}`)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <NavLink
          href={`/${locale}/wiki/weapons`}
          loadingLabel={t('wiki.categories.weapons')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')}
        >
          <ChevronLeft data-icon="inline-start" />
          {t('wiki.backTo', { category: t('wiki.categories.weapons') })}
        </NavLink>
        {/* 对比两把武器时, 顶栏是唯一常驻的区分点。 */}
        <h1 className="min-w-0 truncate text-base font-semibold tracking-tight">{name}</h1>
      </header>
      <WikiMaterialCatalogProvider catalog={catalog}>
        <WikiDetailShell tocItems={[
          { id: 'overview', label: t('wiki.overview') },
          { id: 'level-data', label: t('wiki.levelData') },
          { id: 'skills', label: t('wiki.skills') },
          { id: 'breakthroughs', label: t('wiki.breakthroughs') },
        ]}>
          <WeaponDetailContent
            detail={detail}
            name={name}
            rarity={weapon.rarity}
            imageId={weapon.imageId}
            meta={<span>{t('wiki.weaponType')}: {weaponType}</span>}
          />
        </WikiDetailShell>
      </WikiMaterialCatalogProvider>
    </div>
  )
}
