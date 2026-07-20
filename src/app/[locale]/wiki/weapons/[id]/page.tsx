import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { NavLink } from '@/components/shared/nav-link'
import { WeaponDetailContent, WikiDetailShell } from '@/components/wiki/wiki-detail-content'
import { wikiWeapons } from '@/generated/data/wiki/weapons'
import wikiEnums from '@/generated/data/wiki/enums.json'
import { getWeaponWikiDetail } from '@/lib/wiki-data'
import type { WikiEnumLabels, WikiLocale } from '@/types/wiki'
import { getAlternates } from '@/lib/metadata'

const enums = wikiEnums as WikiEnumLabels

export function generateStaticParams() {
  return wikiWeapons.map((weapon) => ({ id: weapon.id }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params
  const weapon = wikiWeapons.find((entry) => entry.id === id)
  if (!weapon) return { title: 'Not Found' }
  return {
    title: `${weapon.name[locale as WikiLocale] || weapon.name['zh-CN']} - Wiki`,
    alternates: getAlternates(locale, `wiki/weapons/${id}`),
  }
}

export default async function WikiWeaponDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const weapon = wikiWeapons.find((entry) => entry.id === id)
  const detail = getWeaponWikiDetail(id)
  if (!weapon || !detail) notFound()
  const t = await getTranslations({ locale })
  const currentLocale = locale as WikiLocale
  const name = weapon.name[currentLocale] || weapon.name['zh-CN']
  const weaponType = enums.weaponTypes[weapon.weaponTypeId]?.[currentLocale] || enums.weaponTypes[weapon.weaponTypeId]?.['zh-CN'] || weapon.weaponTypeId

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)] sm:px-6 lg:px-8">
        <SidebarTrigger />
        <NavLink href={`/${locale}/wiki/weapons`} loadingLabel={t('wiki.categories.weapons')} className="text-sm text-muted-foreground hover:text-foreground">
          {t('wiki.backTo', { category: t('wiki.categories.weapons') })}
        </NavLink>
      </header>
      <WikiDetailShell>
        <WeaponDetailContent
          detail={detail}
          name={name}
          rarity={weapon.rarity}
          imageId={weapon.imageId}
          meta={<><span>{t('wiki.weaponType')}: {weaponType}</span><span>{t('wiki.maxLevel')}: {weapon.maxLevel}</span></>}
        />
      </WikiDetailShell>
    </div>
  )
}
