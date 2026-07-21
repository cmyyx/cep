'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { RarityStars } from '@/components/shared/rarity-stars'
import { NavLink } from '@/components/shared/nav-link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export interface PlannerWikiPreviewRow {
  label: string
  levelOne: string
  maxLevel: string
  truncate?: boolean
}

export interface PlannerWikiPreviewProps {
  title: string
  imageSrc?: string
  rarity: number
  rows: PlannerWikiPreviewRow[]
  levelOneLabel?: string
  maxLevelLabel?: string
  compact?: boolean
  wikiHref?: string
  footer?: ReactNode
}

export function plainWikiPreviewText(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export function plainWikiPreviewValue(value: string): string {
  const text = plainWikiPreviewText(value)
  return text.match(/[+-]?\d+(?:\.\d+)?%?/)?.[0] ?? text
}

export function PlannerWikiPreview({
  title,
  imageSrc,
  rarity,
  rows,
  levelOneLabel = 'Lv.1',
  maxLevelLabel = 'Lv.9',
  compact = false,
  wikiHref,
  footer,
}: PlannerWikiPreviewProps) {
  const t = useTranslations()

  return (
    <div className={compact ? 'w-64 max-w-[calc(100vw-4.5rem)] min-w-0 space-y-3 text-foreground' : 'w-80 min-w-0 space-y-3 text-foreground'}>
      <div className={compact ? 'flex min-w-0 items-start justify-between gap-3 bg-popover pb-2' : 'sticky top-0 z-10 flex min-w-0 items-start justify-between gap-3 bg-popover pb-2'}>
        <h3 className={compact ? 'min-w-0 flex-1 line-clamp-2 text-sm font-semibold text-popover-foreground' : 'min-w-0 flex-1 truncate text-sm font-semibold text-popover-foreground'} title={title}>{title}</h3>
        <div className="shrink-0 pt-0.5"><RarityStars rarity={rarity} size="sm" /></div>
      </div>
      {imageSrc ? (
        <RarityFrame
          imageSrc={imageSrc}
          title={title}
          rarity={rarity}
          imageClassName="object-contain p-3"
          className="mx-auto w-full max-w-40"
        />
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-md shadow-[var(--shadow-border)]">
          <Table className="table-fixed [&_th+th]:shadow-[-1px_0_0_0_rgba(0,0,0,0.08)] [&_td+td]:shadow-[-1px_0_0_0_rgba(0,0,0,0.08)]">
            <TableHeader>
              <TableRow className="bg-muted/45 hover:bg-muted/45">
                <TableHead className="w-[38%] text-xs">{t('wiki.attributes')}</TableHead>
                <TableHead className="w-[31%] text-right font-geist-mono text-xs">{levelOneLabel}</TableHead>
                <TableHead className="w-[31%] text-right font-geist-mono text-xs">{maxLevelLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.label}-${index}`}>
                  <TableCell className="truncate text-xs text-muted-foreground" title={row.label}>{row.label}</TableCell>
                  <TableCell className="min-w-0 text-right font-geist-mono text-xs">
                    <span className={row.truncate ? 'block truncate' : 'block'} title={row.levelOne}>{row.levelOne}</span>
                  </TableCell>
                  <TableCell className="min-w-0 text-right font-geist-mono text-xs">
                    <span className={row.truncate ? 'block truncate' : 'block'} title={row.maxLevel}>{row.maxLevel}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {footer}
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
