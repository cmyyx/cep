'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp, ImageOff } from 'lucide-react'
import { RarityStars } from '@/components/shared/rarity-stars'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WikiRichText } from '@/components/wiki/wiki-rich-text'
import { useIsMobile } from '@/hooks/use-mobile'
import wikiEnums from '@/generated/data/wiki/enums.json'
import { withImageCacheVersion } from '@/lib/image-url'
import type {
  LocalizedText,
  WikiCharacterDetail,
  WikiCharacterSkill,
  WikiCharacterSkillVariant,
  WikiCharacterVoiceName,
  WikiEquipmentDetail,
  WikiLocale,
  WikiMaterial,
  WikiEquipmentStat,
  WikiWeaponDetail,
  WikiWeaponLevel,
} from '@/types/wiki'

interface WikiDetailShellProps {
  children: React.ReactNode
}

export function WikiDetailShell({ children }: WikiDetailShellProps) {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="w-full min-w-0 px-3 py-4 sm:px-5 sm:py-5 lg:px-6">{children}</div>
    </div>
  )
}

interface WikiDetailHeroProps {
  name: string
  rarity: number
  imagePath: string
  meta: React.ReactNode
  imageClassName?: string
  actions?: React.ReactNode
}

export function WikiDetailHero({ name, rarity, imagePath, meta, imageClassName, actions }: WikiDetailHeroProps) {
  const [failed, setFailed] = useState(false)
  return (
    <section className="grid min-w-0 gap-5 pb-6 shadow-[0_1px_0_0_rgba(0,0,0,0.08)] lg:grid-cols-[minmax(240px,340px)_minmax(0,1fr)] lg:items-end">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted/50 shadow-[var(--shadow-border)]">
        {!failed ? (
          <Image
            src={withImageCacheVersion(imagePath)}
            alt={name}
            fill
            preload
            unoptimized
            sizes="(max-width: 1024px) 100vw, 340px"
            className={imageClassName ?? 'object-contain p-5'}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-[-0.96px] sm:text-3xl">{name}</h1>
            <div className="mt-2"><RarityStars rarity={rarity} size="md" /></div>
          </div>
          {actions}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">{meta}</div>
      </div>
    </section>
  )
}

function localized(value: LocalizedText, locale: WikiLocale) {
  return value[locale] || value['zh-CN']
}

function AssetIcon({ path, alt }: { path: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-neutral-950 shadow-[var(--shadow-border)]">
      {failed ? (
        <ImageOff className="size-4 text-muted-foreground" aria-label={alt} />
      ) : (
        <Image
          src={withImageCacheVersion(path)}
          alt={alt}
          width={28}
          height={28}
          unoptimized
          className="size-7 object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}

function MaterialList({ materials }: { materials: WikiMaterial[] }) {
  const locale = useLocale() as WikiLocale
  return (
    <div className="flex min-w-0 flex-wrap gap-3">
      {materials.map((material) => (
        <div key={`${material.itemId}-${material.count}`} className="flex min-w-0 items-center gap-2">
          <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted shadow-[var(--shadow-border)]">
            <Image
              src={withImageCacheVersion(`/images/items/${material.iconId}.avif`)}
              alt=""
              fill
              unoptimized
              sizes="48px"
              className="object-contain p-1"
            />
          </span>
          <span className="min-w-0">
            <span className="block max-w-36 truncate text-xs font-medium">{localized(material.name, locale)}</span>
            <span className="block font-geist-mono text-xs text-muted-foreground">×{material.count}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function MaterialDisclosure({ materials }: { materials?: WikiMaterial[] }) {
  const t = useTranslations()
  const isMobile = useIsMobile()
  if (!materials?.length) return <span className="text-muted-foreground">—</span>
  const trigger = (
    <Button type="button" variant="outline" size="xs">
      {t('wiki.materialCount', { count: materials.length })}
    </Button>
  )
  if (isMobile) {
    return (
      <Dialog>
        <DialogTrigger render={trigger} />
        <DialogContent showCloseButton={false} className="max-h-[90svh] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogTitle>{t('wiki.materials')}</DialogTitle>
          <DialogDescription>{t('wiki.materialCount', { count: materials.length })}</DialogDescription>
          <MaterialList materials={materials} />
          <DialogClose render={<Button type="button" variant="outline" />}>{t('wiki.closePreview')}</DialogClose>
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent className="w-80 max-w-[calc(100vw-2rem)] bg-popover p-3 text-popover-foreground shadow-[var(--shadow-card)]">
        <MaterialList materials={materials} />
      </TooltipContent>
    </Tooltip>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card size="sm" className="min-w-0 gap-3">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  )
}

export function getVisibleCharacterLevels(levels: WikiCharacterDetail['levels'], showAll: boolean) {
  return showAll ? levels : levels.filter((level) => level.level === 90)
}

export function getVisibleWeaponLevels(levels: WikiWeaponLevel[], showAll: boolean) {
  return showAll ? levels : levels.filter((level) => level.level === 90)
}

export function getVisibleSkillLevels<T extends { level: number }>(levels: T[], showAll: boolean) {
  return showAll ? levels : levels.slice(-1)
}

export function getVoiceActorDisplayName(voice: WikiCharacterVoiceName, locale: WikiLocale): string {
  return voice.original || voice.localized[locale] || voice.localized['zh-CN'] || '—'
}


export function getAdjacentSpans<T>(values: readonly T[]): number[] {
  const spans = Array<number>(values.length).fill(0)
  let start = 0
  while (start < values.length) {
    let end = start + 1
    while (end < values.length && Object.is(values[end], values[start])) end += 1
    spans[start] = end - start
    start = end
  }
  return spans
}
export function getSkillDisplayVariants(skill: WikiCharacterSkill): WikiCharacterSkillVariant[] {
  return skill.variants?.length
    ? skill.variants
    : [{ id: skill.id, iconId: skill.iconId, metrics: skill.metrics, levels: skill.levels }]
}
export function getEquipmentStatValues(stat: WikiEquipmentStat) {
  return stat.displayValues ?? stat.values
}

function LevelToggle({
  showAll,
  onToggle,
  collapseLabel,
  expandLabel,
}: {
  showAll: boolean
  onToggle: () => void
  collapseLabel?: string
  expandLabel?: string
}) {
  const t = useTranslations()
  return (
    <Button type="button" variant="outline" size="sm" onClick={onToggle}>
      {showAll ? <ChevronUp data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
      {showAll ? collapseLabel ?? t('wiki.collapseLevels') : expandLabel ?? t('wiki.showAllLevels')}
    </Button>
  )
}

function CharacterLevelTable({ detail }: { detail: WikiCharacterDetail }) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  const [showAll, setShowAll] = useState(false)
  const visibleLevels = useMemo(() => getVisibleCharacterLevels(detail.levels, showAll), [detail.levels, showAll])
  const attributeIds = detail.levels[0]?.stats.map((stat) => stat.attributeId) ?? []
  const attributes = (wikiEnums as { attributes: Record<string, LocalizedText> }).attributes
  const breakStageSpans = getAdjacentSpans(visibleLevels.map((level) => level.breakStage))
  const attributeSpans = Object.fromEntries(attributeIds.map((id) => [
    id,
    getAdjacentSpans(visibleLevels.map((level) => level.stats.find((stat) => stat.attributeId === id)?.value ?? '—')),
  ]))
  return (
    <Section title={t('wiki.levelData')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="font-geist-mono text-xs text-muted-foreground">{t('wiki.maxLevel')}: {detail.maxLevel}</span>
        <LevelToggle showAll={showAll} onToggle={() => setShowAll((value) => !value)} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('wiki.level')}</TableHead>
            <TableHead>{t('wiki.breakStage')}</TableHead>
            {attributeIds.map((id) => <TableHead key={id}>{localized(attributes[id] ?? { 'zh-CN': id, en: id, ja: id, 'zh-TW': id }, locale)}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleLevels.map((level, rowIndex) => (
            <TableRow key={`${level.level}-${level.breakStage}`}>
              <TableCell className="font-geist-mono">{level.level}</TableCell>
              {breakStageSpans[rowIndex] > 0 && (
                <TableCell rowSpan={breakStageSpans[rowIndex]} className="align-top font-geist-mono">{level.breakStage}</TableCell>
              )}
              {attributeIds.map((id) => attributeSpans[id][rowIndex] > 0 ? (
                <TableCell key={id} rowSpan={attributeSpans[id][rowIndex]} className="align-top font-geist-mono">
                  {level.stats.find((stat) => stat.attributeId === id)?.value ?? '—'}
                </TableCell>
              ) : null)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}

function CharacterSkills({ detail }: { detail: WikiCharacterDetail }) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  const skillTypes = (wikiEnums as { skillTypes: Record<string, LocalizedText> }).skillTypes
  const [expandedSkillIds, setExpandedSkillIds] = useState<Set<string>>(new Set())
  return (
    <Section title={t('wiki.skills')}>
      <div className="space-y-5">
        {detail.skills.map((skill) => {
          const variants = getSkillDisplayVariants(skill)
          return (
            <article key={skill.id} className="min-w-0 rounded-lg bg-muted/25 p-3 sm:p-4">
              <div className="flex min-w-0 items-start gap-3">
                <AssetIcon path={`/images/wiki/skills/${skill.iconId}.avif`} alt={localized(skill.name, locale)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{localized(skill.name, locale)}</h3>
                    <Badge variant="secondary">{localized(skillTypes[skill.typeId] ?? { 'zh-CN': skill.typeId, en: skill.typeId, ja: skill.typeId, 'zh-TW': skill.typeId }, locale)}</Badge>
                  </div>
                  <WikiRichText value={localized(skill.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
                </div>
              </div>
              <div className="mt-4 space-y-4">
                {variants.map((variant, variantIndex) => {
                  const displayId = `${skill.id}:${variant.id}`
                  const showAll = expandedSkillIds.has(displayId)
                  const visibleLevels = getVisibleSkillLevels(variant.levels, showAll)
                  return (
                    <div key={variant.id} className={variants.length > 1 ? 'min-w-0 rounded-md bg-background p-3 shadow-[var(--shadow-border)]' : 'min-w-0'}>
                      {variants.length > 1 ? (
                        <div className="flex min-w-0 items-start gap-3">
                          <AssetIcon path={`/images/wiki/skills/${variant.iconId}.avif`} alt={localized(skill.name, locale)} />
                          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-medium">{t('wiki.skillForm', { number: variantIndex + 1 })}</h4>
                            <LevelToggle
                              showAll={showAll}
                              onToggle={() => setExpandedSkillIds((current) => {
                                const next = new Set(current)
                                if (next.has(displayId)) next.delete(displayId)
                                else next.add(displayId)
                                return next
                              })}
                              collapseLabel={t('wiki.collapseSkillLevels')}
                              expandLabel={t('wiki.showAllSkillLevels')}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <LevelToggle
                            showAll={showAll}
                            onToggle={() => setExpandedSkillIds((current) => {
                              const next = new Set(current)
                              if (next.has(displayId)) next.delete(displayId)
                              else next.add(displayId)
                              return next
                            })}
                            collapseLabel={t('wiki.collapseSkillLevels')}
                            expandLabel={t('wiki.showAllSkillLevels')}
                          />
                        </div>
                      )}
                      <div className="mt-3 min-w-0 overflow-x-auto">
                        <Table className="min-w-[48rem]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('wiki.level')}</TableHead>
                              {variant.metrics.map((metric) => <TableHead key={metric.id}>{localized(metric.label, locale)}</TableHead>)}
                              <TableHead>{t('wiki.coolDown')}</TableHead>
                              <TableHead>{t('wiki.skillCost')}</TableHead>
                              <TableHead>{t('wiki.materials')}</TableHead>
                              <TableHead>{t('wiki.goldCost')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleLevels.map((level) => (
                              <TableRow key={level.level}>
                                <TableCell className="font-geist-mono font-medium">{level.label}</TableCell>
                                {variant.metrics.map((metric, index) => <TableCell key={metric.id} className="font-geist-mono">{level.values[index] || '—'}</TableCell>)}
                                <TableCell className="font-geist-mono">{level.coolDown ?? '—'}</TableCell>
                                <TableCell className="font-geist-mono">{level.costValue ?? '—'}</TableCell>
                                <TableCell><MaterialDisclosure materials={level.materials} /></TableCell>
                                <TableCell className="font-geist-mono">{level.goldCost ?? '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>
    </Section>
  )
}

function CharacterTalents({ detail }: { detail: WikiCharacterDetail }) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  return (
    <Section title={t('wiki.talents')}>
      <div className="space-y-4">
        {detail.talents.map((talent) => (
          <article key={talent.id} className="flex min-w-0 gap-3">
            {talent.iconId && <AssetIcon path={`/images/wiki/skills/${talent.iconId}.avif`} alt={localized(talent.name, locale)} />}
            <div className="min-w-0">
              <h3 className="font-medium">{localized(talent.name, locale)}</h3>
              <Badge variant="secondary" className="mb-1">{t('wiki.breakStage')} {talent.breakStage}</Badge>
              <WikiRichText value={localized(talent.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
              <MaterialDisclosure materials={talent.materials} />
            </div>
          </article>
        ))}
      </div>
    </Section>
  )
}

function CharacterAttributeNodes({ detail }: { detail: WikiCharacterDetail }) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  const attributes = (wikiEnums as { attributes: Record<string, LocalizedText> }).attributes
  return (
    <Section title={t('wiki.attributeNodes')}>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {detail.attributeNodes.map((node) => (
          <article key={node.id} className="min-w-0 rounded-md bg-muted/35 p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium">{localized(node.title, locale)}</h3>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{t('wiki.breakStage')} {node.breakStage}</span>
                  <span>{t('wiki.favorability')} {node.favorability}</span>
                </div>
                <WikiRichText value={localized(node.description, locale)} className="mt-2 block text-sm leading-relaxed text-muted-foreground" />
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {node.stats.map((stat) => (
                    <span key={stat.attributeId}>
                      <span className="text-muted-foreground">{localized(attributes[stat.attributeId] ?? { 'zh-CN': stat.attributeId, en: stat.attributeId, ja: stat.attributeId, 'zh-TW': stat.attributeId }, locale)}</span>{' '}
                      <span className="font-geist-mono">+{stat.value}</span>
                    </span>
                  ))}
                </div>
                <div className="mt-3"><MaterialDisclosure materials={node.materials} /></div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  )
}

function CharacterPotentials({ detail }: { detail: WikiCharacterDetail }) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  return (
    <Section title={t('wiki.potentials')}>
      <div className="space-y-4">
        {detail.potentials.map((potential) => (
          <article key={potential.id} className="flex min-w-0 gap-3">
            <Badge variant="secondary" className="size-8 shrink-0 justify-center rounded-full p-0 font-geist-mono">{potential.level}</Badge>
            <div className="min-w-0">
              <h3 className="font-medium">{localized(potential.name, locale)}</h3>
              <WikiRichText value={localized(potential.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
              {potential.imageIds.length > 0 && (
                <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {potential.imageIds.map((imageId) => {
                    const imagePath = withImageCacheVersion(`/images/wiki/character-potential/${imageId}.avif`)
                    return (
                      <Dialog key={imageId}>
                        <DialogTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              className="relative aspect-[2/1] h-auto w-full overflow-hidden rounded-md bg-muted/50 p-0 shadow-[var(--shadow-border)] hover:bg-muted/70"
                              aria-label={t('wiki.openPotentialPreview', { name: localized(potential.name, locale) })}
                            />
                          }
                        >
                          <Image src={imagePath} alt={localized(potential.name, locale)} fill unoptimized sizes="(max-width: 640px) 50vw, 320px" className="object-contain" />
                        </DialogTrigger>
                        <DialogContent showCloseButton={false} className="max-h-[90svh] max-w-[calc(100%-2rem)] bg-black/95 p-3 sm:max-w-5xl">
                          <DialogTitle className="sr-only">{localized(potential.name, locale)}</DialogTitle>
                          <DialogDescription className="sr-only">{t('wiki.potentialPreview')}</DialogDescription>
                          <div className="relative aspect-[2/1] max-h-[80svh] w-full">
                            <Image src={imagePath} alt={localized(potential.name, locale)} fill unoptimized sizes="90vw" className="object-contain" />
                          </div>
                          <DialogClose render={<Button type="button" variant="outline" className="text-foreground" />}>{t('wiki.closePreview')}</DialogClose>
                        </DialogContent>
                      </Dialog>
                    )
                  })}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </Section>
  )
}

function CharacterLogistics({ detail }: { detail: WikiCharacterDetail }) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  return (
    <Section title={t('wiki.logisticsSkills')}>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {detail.logisticsSkills.map((skill) => (
          <article key={skill.id} className="flex min-w-0 gap-3">
            {skill.iconId && <AssetIcon path={`/images/wiki/logistics/${skill.iconId}.avif`} alt={localized(skill.name, locale)} />}
            <div className="min-w-0">
              <h3 className="font-medium">{localized(skill.name, locale)}</h3>
              <Badge variant="secondary" className="mb-1">{localized(skill.unlockHint, locale)}</Badge>
              <WikiRichText value={localized(skill.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
            </div>
          </article>
        ))}
      </div>
      {detail.logisticsNodes.length > 0 && (
        <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">
          {detail.logisticsNodes.map((node) => (
            <article key={node.id} className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-muted/35 p-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium">{t('wiki.logisticsNode', { index: node.index + 1, level: node.level })}</h3>
                <span className="text-xs text-muted-foreground">{t('wiki.breakStage')} {node.breakStage}</span>
              </div>
              <MaterialDisclosure materials={node.materials} />
            </article>
          ))}
        </div>
      )}
    </Section>
  )
}

function CharacterPromotions({ detail }: { detail: WikiCharacterDetail }) {
  const t = useTranslations()
  return (
    <Section title={t('wiki.promotions')}>
      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        {detail.promotions.map((promotion) => (
          <article key={promotion.breakStage} className="min-w-0 rounded-md bg-muted/35 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{t('wiki.breakStage')} {promotion.breakStage}</h3>
              <span className="font-geist-mono text-xs text-muted-foreground">Lv.{promotion.requiredLevel}</span>
            </div>
            <MaterialList materials={promotion.materials} />
          </article>
        ))}
      </div>
    </Section>
  )
}

interface CharacterMetaRow {
  label: string
  value: string
}

function CharacterMetaTables({ rows, voices }: { rows: CharacterMetaRow[]; voices: WikiCharacterVoiceName[] }) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  return (
    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
      <div className="min-w-0 overflow-hidden rounded-md shadow-[var(--shadow-border)]">
        <h2 className="bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground">{t('wiki.baseInfo')}</h2>
        <Table>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="w-28 text-muted-foreground">{row.label}</TableCell>
                <TableCell className="font-medium text-foreground">{row.value || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="min-w-0 overflow-hidden rounded-md shadow-[var(--shadow-border)]">
        <h2 className="bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground">{t('wiki.cv')}</h2>
        <Table>
          <TableBody>
            {voices.map((voice) => (
              <TableRow key={voice.language}>
                <TableCell className="w-28 text-muted-foreground">{t(`wiki.voiceLanguages.${voice.language}`)}</TableCell>
                <TableCell className="font-medium text-foreground">{getVoiceActorDisplayName(voice, locale)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function CharacterDetailContent({
  detail,
  name,
  rarity,
  imageIds,
  metaRows,
}: {
  detail: WikiCharacterDetail
  name: string
  rarity: number
  imageIds: WikiCharacterDetail['images']
  metaRows: CharacterMetaRow[]
}) {
  const t = useTranslations()
  const [variant, setVariant] = useState<'female' | 'male'>('female')
  const fullBodyIds = imageIds.fullBodyIds
  const isAdministrator = Boolean(fullBodyIds.male && fullBodyIds.female)
  const selectedImage = fullBodyIds[variant] ?? fullBodyIds.default ?? imageIds.defaultAvatarId
  return (
    <>
      <WikiDetailHero
        name={name}
        rarity={rarity}
        imagePath={`/images/characters/full/${selectedImage}.avif`}
        imageClassName="object-contain object-bottom"
        meta={<CharacterMetaTables rows={metaRows} voices={detail.cvNames} />}
        actions={isAdministrator ? (
          <div className="flex items-center gap-2 text-xs">
            <span>{t(`wiki.${variant}`)}</span>
            <Switch checked={variant === 'male'} onCheckedChange={(checked) => setVariant(checked ? 'male' : 'female')} aria-label={t('wiki.male')} />
          </div>
        ) : undefined}
      />
      <div className="mt-5 min-w-0 space-y-4">
        <CharacterLevelTable detail={detail} />
        {detail.attributeNodes.length > 0 && <CharacterAttributeNodes detail={detail} />}
        <CharacterSkills detail={detail} />
        <CharacterTalents detail={detail} />
        <CharacterPotentials detail={detail} />
        <CharacterLogistics detail={detail} />
        <CharacterPromotions detail={detail} />
      </div>
    </>
  )
}

function attributeLabel(attributeId: string, locale: WikiLocale, translate: (key: string) => string, hasTranslation: (key: string) => boolean) {
  if (attributeId === 'baseAttack') return translate('wiki.baseAttack')
  if (hasTranslation(`equipStats.${attributeId}`)) return translate(`equipStats.${attributeId}`)
  const attributes = (wikiEnums as { attributes: Record<string, LocalizedText> }).attributes
  return localized(attributes[attributeId] ?? { 'zh-CN': attributeId, en: attributeId, ja: attributeId, 'zh-TW': attributeId }, locale)
}

function WeaponLevelTable({ detail }: { detail: WikiWeaponDetail }) {
  const t = useTranslations()
  const [showAll, setShowAll] = useState(false)
  const levels = useMemo(() => getVisibleWeaponLevels(detail.levels, showAll), [detail.levels, showAll])
  const attackSpans = getAdjacentSpans(levels.map((level) => level.baseAttack))
  return (
    <Section title={`${t('wiki.levelData')} · ${t('wiki.baseAttack')}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="font-geist-mono text-xs text-muted-foreground">{t('wiki.maxLevel')}: {detail.maxLevel}</span>
        <LevelToggle showAll={showAll} onToggle={() => setShowAll((value) => !value)} />
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>{t('wiki.level')}</TableHead><TableHead>{t('wiki.baseAttack')}</TableHead></TableRow></TableHeader>
        <TableBody>{levels.map((level, rowIndex) => <TableRow key={level.level}><TableCell className="font-geist-mono">{level.level}</TableCell>{attackSpans[rowIndex] > 0 && <TableCell rowSpan={attackSpans[rowIndex]} className="align-top font-geist-mono">{level.baseAttack}</TableCell>}</TableRow>)}</TableBody>
      </Table>
    </Section>
  )
}

export function WeaponDetailContent({ detail, name, rarity, imageId, meta }: { detail: WikiWeaponDetail; name: string; rarity: number; imageId: string; meta: React.ReactNode }) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  const [expandedSkillIds, setExpandedSkillIds] = useState<Set<string>>(new Set())
  return (
    <>
      <WikiDetailHero name={name} rarity={rarity} imagePath={`/images/weapon/${imageId}.avif`} meta={meta} />
      <div className="mt-5 min-w-0 space-y-4">
        <WeaponLevelTable detail={detail} />
        <Section title={t('wiki.skills')}>
          <div className="space-y-5">
            {detail.skills.map((skill) => {
              const showAll = expandedSkillIds.has(skill.id)
              const visibleLevels = getVisibleSkillLevels(skill.levels, showAll)
              return (
                <article key={skill.id} className="min-w-0 rounded-md bg-muted/25 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium">{localized(skill.name, locale)}</h3>
                    </div>
                    <LevelToggle
                      showAll={showAll}
                      onToggle={() => setExpandedSkillIds((current) => {
                        const next = new Set(current)
                        if (next.has(skill.id)) next.delete(skill.id)
                        else next.add(skill.id)
                        return next
                      })}
                      collapseLabel={t('wiki.collapseSkillLevels')}
                      expandLabel={t('wiki.showAllSkillLevels')}
                    />
                  </div>
                  <div className="mt-3 space-y-2">
                    {visibleLevels.map((level) => (
                      <div key={level.level} className="min-w-0 rounded-md bg-background p-2.5 shadow-[var(--shadow-border)]">
                        <span className="font-geist-mono text-xs text-muted-foreground">Lv.{level.level}</span>
                        <WikiRichText value={localized(level.description, locale)} className="mt-1 block text-sm leading-relaxed" />
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        </Section>
        <Section title={t('wiki.breakthroughs')}>
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            {detail.breakthroughs.map((breakthrough) => (
              <article key={breakthrough.stage} className="min-w-0 rounded-md bg-muted/35 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{t('wiki.breakStage')} {breakthrough.stage}</h3>
                  <span className="font-geist-mono text-xs text-muted-foreground">Lv.{breakthrough.requiredLevel}</span>
                </div>
                <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {breakthrough.stats.map((stat) => <span key={stat.attributeId}><span className="text-muted-foreground">{attributeLabel(stat.attributeId, locale, t, t.has)}</span> <span className="font-geist-mono">{stat.value}</span></span>)}
                </div>
                <MaterialList materials={breakthrough.materials} />
              </article>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}

function statValues(values: Array<string | number>) {
  return values.map((value) => {
    const text = String(value)
    return text.includes('+') ? text.slice(text.indexOf('+') + 1) : text
  })
}

export function EquipmentDetailContent({ detail, name, rarity, imageId, meta }: { detail: WikiEquipmentDetail; name: string; rarity: number; imageId: string; meta: React.ReactNode }) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  return (
    <>
      <WikiDetailHero name={name} rarity={rarity} imagePath={`/images/equip/${imageId}.avif`} meta={meta} />
      <div className="mt-5 min-w-0 space-y-4">
        <Section title={t('wiki.stats')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('wiki.stats')}</TableHead>
                {[0, 1, 2, 3].map((level) => <TableHead key={level}>+{level}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.stats.map((stat) => {
                const values = statValues(getEquipmentStatValues(stat))
                const spans = getAdjacentSpans(values)
                return (
                  <TableRow key={stat.attributeId}>
                    <TableCell>{attributeLabel(stat.attributeId, locale, t, t.has)}</TableCell>
                    {values.map((value, level) => spans[level] > 0 ? (
                      <TableCell key={level} colSpan={spans[level]} className="font-geist-mono">{value}</TableCell>
                    ) : null)}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Section>
        <Section title={t('wiki.suitEffects')}>
          <div className="space-y-4">
            {detail.suitEffects.map((effect) => (
              <article key={effect.id} className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{localized(effect.name, locale)}</h3>
                  <Badge variant="secondary">{t('wiki.requiredPieces', { count: effect.requiredPieces })}</Badge>
                </div>
                <WikiRichText value={localized(effect.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
              </article>
            ))}
          </div>
        </Section>
        <Section title={t('wiki.craftingMaterials')}>
          <div className="space-y-3">
            {detail.craftingRecipes.map((recipe) => (
              <article key={recipe.chainId} className="min-w-0 rounded-md bg-muted/35 p-3">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{t('wiki.recipe')} #{recipe.chainId}</h3>
                  {recipe.isDefault && <Badge>{t('wiki.defaultRecipe')}</Badge>}
                  {recipe.discount > 0 && recipe.discount < 1 && (
                    <Badge variant="secondary" className="text-ship-red">-{Math.round((1 - recipe.discount) * 100)}%</Badge>
                  )}
                </div>
                <MaterialList materials={recipe.materials} />
              </article>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
