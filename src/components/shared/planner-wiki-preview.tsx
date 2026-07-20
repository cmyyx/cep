'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { NavLink } from '@/components/shared/nav-link'

export interface PlannerWikiPreviewProps {
  title: string
  imageSrc?: string
  rarity: number
  rows: Array<{ label: string; value: ReactNode }>
  wikiHref?: string
}

export function PlannerWikiPreview({
  title,
  imageSrc,
  rarity,
  rows,
  wikiHref,
}: PlannerWikiPreviewProps) {
  const t = useTranslations()

  return (
    <div className="w-72 min-w-0 space-y-3 text-foreground">
      <RarityFrame
        imageSrc={imageSrc}
        title={title}
        rarity={rarity}
        imageClassName="object-contain p-3"
        className="mx-auto w-full max-w-48"
      />
      <dl className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs">
            <dt className="min-w-0 truncate text-muted-foreground">{row.label}</dt>
            <dd className="max-w-40 text-right font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
      {wikiHref && (
        <NavLink
          href={wikiHref}
          loadingLabel={title}
          className="block rounded-md bg-primary px-3 py-2 text-center text-xs font-medium text-primary-foreground hover:bg-primary/80"
        >
          {t('wiki.viewWiki')}
        </NavLink>
      )}
    </div>
  )
}

export default PlannerWikiPreview
