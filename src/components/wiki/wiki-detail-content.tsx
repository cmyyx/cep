'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import { Switch } from '@/components/ui/switch'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WikiRichText } from '@/components/wiki/wiki-rich-text'
import { WikiTable, WikiTableFrame } from '@/components/wiki/wiki-table'
import { WikiMaterialList } from '@/components/shared/wiki-material-list'
import { WikiDetailToc, type WikiTocItem } from '@/components/wiki/wiki-detail-toc'
import { useIsMobile } from '@/hooks/use-mobile'
import wikiEnums from '@/generated/data/wiki/enums.json'
import { withImageCacheVersion } from '@/lib/image-url'
import { cn } from '@/lib/utils'
import type {
  LocalizedText,
  WikiCharacterDetail,
  WikiCharacterSkill,
  WikiCharacterSkillLevel,
  WikiCharacterSkillVariant,
  WikiCharacterVoiceName,
  WikiEquipmentDetail,
  WikiLocale,
  WikiMaterial,
  WikiEquipmentStat,
  WikiWeaponDetail,
  WikiWeaponLevel,
  WikiSkillMetric,
} from '@/types/wiki'


interface WikiDetailShellProps {
  children: React.ReactNode
  tocItems: WikiTocItem[]
}


const WIKI_SCROLL_DURATION_MS = 420

export function easeWikiScroll(progress: number): number {
  return 1 - (1 - progress) ** 3
}

export function WikiDetailShell({ children, tocItems }: WikiDetailShellProps) {
  const [tocExpanded, setTocExpanded] = useState(false)
  const [activeTocId, setActiveTocId] = useState(tocItems[0]?.id ?? '')
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollTimerRef = useRef<number | null>(null)

  const updateActiveSection = useCallback(() => {
    setTocExpanded(false)
    const scrollRoot = scrollRef.current
    if (!scrollRoot) return
    const rootTop = scrollRoot.getBoundingClientRect().top
    let active = tocItems[0]?.id ?? ''
    for (const item of tocItems) {
      const section = document.getElementById(item.id)
      if (section && section.getBoundingClientRect().top <= rootTop + 120) active = item.id
    }
    setActiveTocId(active)
  }, [tocItems])

  const initializeActiveSection = useCallback(() => {
    const scrollRoot = scrollRef.current
    if (!scrollRoot) return
    const rootTop = scrollRoot.getBoundingClientRect().top
    let active = tocItems[0]?.id ?? ''
    for (const item of tocItems) {
      const section = document.getElementById(item.id)
      if (section && section.getBoundingClientRect().top <= rootTop + 120) active = item.id
    }
    setActiveTocId(active)
  }, [tocItems])

  useEffect(() => {
    const frame = window.requestAnimationFrame(initializeActiveSection)
    return () => window.cancelAnimationFrame(frame)
  }, [initializeActiveSection])

  useEffect(() => () => {
    if (scrollTimerRef.current !== null) window.clearInterval(scrollTimerRef.current)
  }, [])

  return (
    <div
      ref={scrollRef}
      className="relative min-h-0 min-w-0 flex-1 overflow-y-auto"
      onScroll={updateActiveSection}
    >
      <div className="w-full min-w-0 px-3 py-4 sm:px-5 sm:py-5 lg:px-6">{children}</div>
      <WikiDetailToc
        items={tocItems}
        activeId={activeTocId}
        expanded={tocExpanded}
        onExpandedChange={setTocExpanded}
        onNavigate={(id) => {
          const scrollRoot = scrollRef.current
          const section = document.getElementById(id)
          if (!scrollRoot || !section) return
          setActiveTocId(id)
          const startTop = scrollRoot.scrollTop
          const targetTop = startTop + section.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top - 16
          const distance = targetTop - startTop
          const startedAt = performance.now()
          if (scrollTimerRef.current !== null) window.clearInterval(scrollTimerRef.current)
          scrollTimerRef.current = window.setInterval(() => {
            const progress = Math.min((performance.now() - startedAt) / WIKI_SCROLL_DURATION_MS, 1)
            scrollRoot.scrollTop = startTop + distance * easeWikiScroll(progress)
            if (progress >= 1 && scrollTimerRef.current !== null) {
              window.clearInterval(scrollTimerRef.current)
              scrollTimerRef.current = null
            }
          }, 16)
          window.history.replaceState(null, '', `#${id}`)
          setTocExpanded(false)
        }}
      />
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
    <section id="overview" className="grid min-w-0 scroll-mt-4 gap-5 pb-6 shadow-[0_1px_0_0_rgba(0,0,0,0.08)] lg:grid-cols-[minmax(240px,340px)_minmax(0,1fr)] lg:items-end">
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
        <div className="min-w-0 text-sm text-muted-foreground">{meta}</div>
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
  return <WikiMaterialList materials={materials} />
}

function MaterialDisclosure({ materials }: { materials?: WikiMaterial[] }) {
  const t = useTranslations()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  if (!materials?.length) return <span className="text-muted-foreground">—</span>

  return (
    <Tooltip
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isMobile || !nextOpen) setOpen(nextOpen)
      }}
    >
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={isMobile ? () => {
              const nextOpen = !open
              setTimeout(() => setOpen(nextOpen), 0)
            } : undefined}
          />
        }
      >
        {t('wiki.materialCount', { count: materials.length })}
      </TooltipTrigger>
      <TooltipContent
        collisionPadding={16}
        className="max-h-[min(var(--available-height),70svh)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain bg-popover p-3 text-popover-foreground shadow-[var(--shadow-card)]"
      >
        <MaterialList materials={materials} />
      </TooltipContent>
    </Tooltip>
  )
}

function Section({ id, title, actions, children }: { id: string; title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <Card size="sm" className="min-w-0 gap-3">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          {actions}
        </CardHeader>
        <CardContent className="min-w-0">{children}</CardContent>
      </Card>
    </section>
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


export function getWidestTableValue(values: readonly unknown[]): string {
  return values.reduce<string>((widest, value) => {
    const text = value === null || value === undefined || value === '' ? '—' : String(value)
    return text.length > widest.length ? text : widest
  }, '—')
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

function MergedValue({ value, span }: { value: React.ReactNode; span: number }) {
  return (
    <span className={cn('inline-flex min-h-10 items-center px-2 py-2', span > 1 && 'sticky top-10')}>
      {value}
    </span>
  )
}

export function getSkillDisplayVariants(skill: WikiCharacterSkill): WikiCharacterSkillVariant[] {
  return skill.variants ?? []
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
    <Button type="button" variant="ghost" size="sm" onClick={onToggle}>
      {showAll ? <ChevronUp data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
      {showAll ? collapseLabel ?? t('wiki.collapseLevels') : expandLabel ?? t('wiki.showAllLevels')}
    </Button>
  )
}

function CharacterSkillLevelTable({
  metrics,
  levels,
  sizingLevels,
  showAll,
  onToggle,
}: {
  metrics: WikiSkillMetric[]
  levels: WikiCharacterSkillLevel[]
  sizingLevels: WikiCharacterSkillLevel[]
  showAll: boolean
  onToggle: () => void
}) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  const sizingValues = useMemo(() => ({
    label: getWidestTableValue(sizingLevels.map((level) => level.label)),
    metrics: metrics.map((_, index) => getWidestTableValue(sizingLevels.map((level) => level.values[index] || '—'))),
    coolDown: getWidestTableValue(sizingLevels.map((level) => level.coolDown)),
    costValue: getWidestTableValue(sizingLevels.map((level) => level.costValue)),
  }), [metrics, sizingLevels])
  const metricSpans = metrics.map((_, index) => getAdjacentSpans(levels.map((level) => level.values[index] || '—')))
  const coolDownSpans = getAdjacentSpans(levels.map((level) => level.coolDown ?? '—'))
  const costValueSpans = getAdjacentSpans(levels.map((level) => level.costValue ?? '—'))

  return (
    <WikiTableFrame
      scrollClassName="overflow-x-auto"
      className="min-w-[36rem]"
      footer={<LevelToggle showAll={showAll} onToggle={onToggle} collapseLabel={t('wiki.collapseSkillLevels')} expandLabel={t('wiki.showAllSkillLevels')} />}
    >
      <WikiTable className="min-w-full">
        <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('wiki.level')}</TableHead>
            {metrics.map((metric) => <TableHead key={metric.id} className="max-w-28 whitespace-normal text-center leading-tight">{localized(metric.label, locale)}</TableHead>)}
            <TableHead className="whitespace-normal text-center leading-tight">{t('wiki.coolDown')}</TableHead>
            <TableHead className="whitespace-normal text-center leading-tight">{t('wiki.skillCost')}</TableHead>
            <TableHead className="whitespace-normal text-center leading-tight">{t('wiki.materials')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow aria-hidden className="collapse">
            <TableCell className="font-mono font-medium tabular-nums">{sizingValues.label}</TableCell>
            {metrics.map((metric, index) => <TableCell key={metric.id} className="text-center font-mono tabular-nums">{sizingValues.metrics[index]}</TableCell>)}
            <TableCell className="text-center font-mono tabular-nums">{sizingValues.coolDown}</TableCell>
            <TableCell className="text-center font-mono tabular-nums">{sizingValues.costValue}</TableCell>
            <TableCell>—</TableCell>
          </TableRow>
          {levels.map((level, rowIndex) => (
            <TableRow key={level.level}>
              <TableCell className="font-mono font-medium tabular-nums">{level.label}</TableCell>
              {metrics.map((metric, index) => metricSpans[index][rowIndex] > 0 ? (
                <TableCell key={metric.id} rowSpan={metricSpans[index][rowIndex]} className="relative p-0 text-center align-top font-mono tabular-nums">
                  <MergedValue value={level.values[index] || '—'} span={metricSpans[index][rowIndex]} />
                </TableCell>
              ) : null)}
              {coolDownSpans[rowIndex] > 0 ? (
                <TableCell rowSpan={coolDownSpans[rowIndex]} className="relative p-0 text-center align-top font-mono tabular-nums">
                  <MergedValue value={level.coolDown ?? '—'} span={coolDownSpans[rowIndex]} />
                </TableCell>
              ) : null}
              {costValueSpans[rowIndex] > 0 ? (
                <TableCell rowSpan={costValueSpans[rowIndex]} className="relative p-0 text-center align-top font-mono tabular-nums">
                  <MergedValue value={level.costValue ?? '—'} span={costValueSpans[rowIndex]} />
                </TableCell>
              ) : null}
              <TableCell className="text-center"><MaterialDisclosure materials={level.materials} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </WikiTable>
    </WikiTableFrame>
  )
}

const CHARACTER_LEVEL_STAT_IDS = new Set(['39', '40', '41', '42', '1', '2', '49', '25'])

export function isCharacterLevelStat(attributeId: string): boolean {
  return CHARACTER_LEVEL_STAT_IDS.has(attributeId)
}

function CharacterLevelTable({ detail }: { detail: WikiCharacterDetail }) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  const [showAll, setShowAll] = useState(false)
  const visibleLevels = useMemo(() => getVisibleCharacterLevels(detail.levels, showAll), [detail.levels, showAll])
  const attributeIds = useMemo(
    () => (detail.levels[0]?.stats.map((stat) => stat.attributeId) ?? []).filter(isCharacterLevelStat),
    [detail.levels],
  )
  const attributes = (wikiEnums as { attributes: Record<string, LocalizedText> }).attributes
  const levelSizingValue = useMemo(() => getWidestTableValue(detail.levels.map((level) => level.level)), [detail.levels])
  const breakStageSizingValue = useMemo(() => getWidestTableValue(detail.levels.map((level) => level.breakStage)), [detail.levels])
  const attributeSizingValues = useMemo(() => attributeIds.map((id) => getWidestTableValue(
    detail.levels.map((level) => level.stats.find((stat) => stat.attributeId === id)?.value),
  )), [attributeIds, detail.levels])
  const breakStageSpans = getAdjacentSpans(visibleLevels.map((level) => level.breakStage))
  const attributeSpans = Object.fromEntries(attributeIds.map((id) => [
    id,
    getAdjacentSpans(visibleLevels.map((level) => level.stats.find((stat) => stat.attributeId === id)?.value ?? '—')),
  ]))

  return (
    <Section id="level-data" title={t('wiki.levelData')}>
      <WikiTableFrame
        scrollClassName="max-h-[min(60svh,36rem)]"
        className="min-w-[32rem]"
        footer={<LevelToggle showAll={showAll} onToggle={() => setShowAll((value) => !value)} />}
      >
        <WikiTable className="min-w-full">
          <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-30 bg-card">{t('wiki.level')}</TableHead>
              <TableHead className="whitespace-normal text-center leading-tight">{t('wiki.breakStage')}</TableHead>
              {attributeIds.map((id) => (
                <TableHead key={id} className="max-w-32 whitespace-normal text-center leading-tight">
                  {localized(attributes[id] ?? { 'zh-CN': id, en: id, ja: id, 'zh-TW': id }, locale)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow aria-hidden className="collapse">
              <TableCell className="font-mono tabular-nums">{levelSizingValue}</TableCell>
              <TableCell className="text-center font-mono tabular-nums">{breakStageSizingValue}</TableCell>
              {attributeIds.map((id, index) => <TableCell key={id} className="text-center font-mono tabular-nums">{attributeSizingValues[index]}</TableCell>)}
            </TableRow>
            {visibleLevels.map((level, rowIndex) => (
              <TableRow key={`${level.level}-${level.breakStage}`}>
                <TableCell className="sticky left-0 z-10 bg-card font-mono tabular-nums">{level.level}</TableCell>
                {breakStageSpans[rowIndex] > 0 && (
                  <TableCell rowSpan={breakStageSpans[rowIndex]} className="relative p-0 text-center align-top font-mono tabular-nums">
                    <MergedValue value={level.breakStage} span={breakStageSpans[rowIndex]} />
                  </TableCell>
                )}
                {attributeIds.map((id) => attributeSpans[id][rowIndex] > 0 ? (
                  <TableCell key={id} rowSpan={attributeSpans[id][rowIndex]} className="relative p-0 text-center align-top font-mono tabular-nums">
                    <MergedValue value={level.stats.find((stat) => stat.attributeId === id)?.value ?? '—'} span={attributeSpans[id][rowIndex]} />
                  </TableCell>
                ) : null)}
              </TableRow>
            ))}
          </TableBody>
        </WikiTable>
      </WikiTableFrame>
    </Section>
  )
}

function CharacterSkills({ detail }: { detail: WikiCharacterDetail }) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  const skillTypes = (wikiEnums as { skillTypes: Record<string, LocalizedText> }).skillTypes
  const [expandedSkillIds, setExpandedSkillIds] = useState<Set<string>>(new Set())
  const toggleSkillLevels = (id: string) => setExpandedSkillIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  return (
    <Section id="skills" title={t('wiki.skills')}>
      <div className="space-y-5">
        {detail.skills.map((skill) => {
          const variants = getSkillDisplayVariants(skill)
          const showAll = expandedSkillIds.has(skill.id)
          const visibleLevels = getVisibleSkillLevels(skill.levels, showAll)
          return (
            <article key={skill.id} className="min-w-0 rounded-lg bg-muted/25 p-3 sm:p-4">
              <div className="flex min-w-0 items-start gap-3">
                <AssetIcon path={`/images/wiki/skills/${skill.iconId}.avif`} alt={localized(skill.name, locale)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{localized(skill.name, locale)}</h3>
                    <Badge variant="secondary">{localized(skillTypes[skill.typeId] ?? { 'zh-CN': skill.typeId, en: skill.typeId, ja: skill.typeId, 'zh-TW': skill.typeId }, locale)}</Badge>
                  </div>
                  {localized(skill.description, locale) && localized(skill.description, locale) !== '0' ? (
                    <WikiRichText value={localized(skill.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
                  ) : null}
                </div>
              </div>
              {variants.length > 0 ? (
                <div className="mt-3 min-w-0 space-y-3">
                  {variants.map((variant) => {
                    const variantShowAll = expandedSkillIds.has(variant.id)
                    const variantLevels = getVisibleSkillLevels(variant.levels, variantShowAll)
                    return (
                      <div key={variant.id} className="min-w-0 rounded-md bg-background p-3 shadow-[var(--shadow-border)]">
                        <div className="flex min-w-0 items-start gap-3">
                          <AssetIcon path={`/images/wiki/skills/${variant.iconId}.avif`} alt={localized(variant.name, locale)} />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-medium">{localized(variant.name, locale)}</h4>
                            <WikiRichText value={localized(variant.condition, locale)} className="mt-1 block text-xs leading-relaxed text-muted-foreground" />
                            <WikiRichText value={localized(variant.description, locale)} className="mt-2 block text-sm leading-relaxed" />
                          </div>
                        </div>
                        <div className="mt-3 min-w-0">
                          <CharacterSkillLevelTable metrics={variant.metrics} levels={variantLevels} sizingLevels={variant.levels} showAll={variantShowAll} onToggle={() => toggleSkillLevels(variant.id)} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-3 min-w-0">
                  <CharacterSkillLevelTable metrics={skill.metrics} levels={visibleLevels} sizingLevels={skill.levels} showAll={showAll} onToggle={() => toggleSkillLevels(skill.id)} />
                </div>
              )}
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
    <Section id="talents" title={t('wiki.talents')}>
      <div className="space-y-4">
        {detail.talents.map((talent) => (
          <article key={talent.id} className="flex min-w-0 gap-3">
            {talent.iconId && <AssetIcon path={`/images/wiki/skills/${talent.iconId}.avif`} alt={localized(talent.name, locale)} />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{localized(talent.name, locale)}</h3>
                  <Badge variant="secondary">{t('wiki.breakStage')} {talent.breakStage}</Badge>
                </div>
                {talent.breakStage === 0 && talent.materials.length === 0 ? <Badge variant="secondary">{t('wiki.defaultUnlocked')}</Badge> : <MaterialDisclosure materials={talent.materials} />}
              </div>
              <WikiRichText value={localized(talent.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
            </div>
          </article>
        ))}
      </div>
    </Section>
  )
}

function CharacterEquipmentNodes({ detail }: { detail: WikiCharacterDetail }) {
  const t = useTranslations()
  const { text } = useWikiTranslations()
  return (
    <Section id="equipment-nodes" title={text('ui', 'equipmentAdaptation')}>
      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        {detail.equipmentNodes.map((node) => (
          <article key={node.id} className="min-w-0 rounded-md bg-muted/35 p-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 font-medium">{text('character', detail.id, 'equipment', node.id, 'name')}</h3>
              <Badge variant="secondary" className="shrink-0">{t('wiki.breakStage')} {node.breakStage}</Badge>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text('character', detail.id, 'equipment', node.id, 'description')}</p>
            <div className="mt-3"><MaterialList materials={node.materials} /></div>
          </article>
        ))}
      </div>
    </Section>
  )
}

function CharacterAttributeNodes({ detail }: { detail: WikiCharacterDetail }) {
  const t = useTranslations()
  const { enumLabel, text } = useWikiTranslations()
  return (
    <Section id="attribute-nodes" title={t('wiki.attributeNodes')}>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {detail.attributeNodes.map((node) => (
          <article key={node.id} className="relative min-w-0 rounded-md bg-muted/35 p-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 font-medium">{text('character', detail.id, 'attribute', node.id, 'name')}</h3>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <span>{t('wiki.breakStage')} {node.breakStage}</span>
                <span className="ml-2">{t('wiki.favorability')} {node.favorability}</span>
              </div>
            </div>
            <WikiRichText value={text('character', detail.id, 'attribute', node.id, 'description')} className="mt-2 block pr-24 text-sm leading-relaxed text-muted-foreground" />
            <div className="mt-2 flex min-w-0 items-end justify-between gap-3">
              <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-sm">
                {node.stats.map((stat) => <span key={stat.attributeId}><span className="text-muted-foreground">{enumLabel('attributes', stat.attributeId)}</span>{' '}<span className="font-geist-mono">+{stat.value}</span></span>)}
              </div>
              <div className="shrink-0"><MaterialDisclosure materials={node.materials} /></div>
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
    <Section id="potentials" title={t('wiki.potentials')}>
      <div className="space-y-4">
        {detail.potentials.map((potential) => (
          <article key={potential.id} className="flex min-w-0 gap-3">
            <Badge variant="secondary" className="size-8 shrink-0 justify-center rounded-full p-0 font-geist-mono">{potential.level}</Badge>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium">{localized(potential.name, locale)}</h3>
              <WikiRichText value={localized(potential.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
              {potential.imageIds.length > 0 && (
                <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                  {potential.imageIds.map((imageId) => {
                    const imagePath = withImageCacheVersion(`/images/wiki/character-potential/${imageId}.avif`)
                    return (
                      <Dialog key={imageId}>
                        <DialogTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              className="relative aspect-[2/1] h-auto w-full max-w-72 overflow-hidden rounded-md bg-muted/50 p-0 shadow-[var(--shadow-border)] hover:bg-muted/70"
                              aria-label={t('wiki.openPotentialPreview', { name: localized(potential.name, locale) })}
                            />
                          }
                        >
                          <Image src={imagePath} alt={localized(potential.name, locale)} fill unoptimized sizes="288px" className="object-contain" />
                        </DialogTrigger>
                        <DialogContent showCloseButton={false} className="h-[calc(100svh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] grid-rows-[minmax(0,1fr)_auto] bg-popover p-3 text-popover-foreground shadow-[var(--shadow-card)] sm:max-w-[min(96vw,90rem)]">
                          <DialogTitle className="sr-only">{localized(potential.name, locale)}</DialogTitle>
                          <DialogDescription className="sr-only">{t('wiki.potentialPreview')}</DialogDescription>
                          <div className="relative min-h-0 w-full rounded-md bg-muted/30">
                            <Image src={imagePath} alt={localized(potential.name, locale)} fill unoptimized sizes="96vw" className="object-contain" />
                          </div>
                          <DialogClose render={<Button type="button" variant="outline" />}>{t('wiki.closePreview')}</DialogClose>
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
  const skillGroups = useMemo(() => {
    const groups = new Map<number, WikiCharacterDetail['logisticsSkills']>()
    for (const skill of detail.logisticsSkills) {
      const group = groups.get(skill.index) ?? []
      group.push(skill)
      groups.set(skill.index, group)
    }
    return [...groups.entries()]
      .sort(([left], [right]) => left - right)
      .map(([index, skills]) => [index, [...skills].sort((left, right) => left.level - right.level)] as const)
  }, [detail.logisticsSkills])
  return (
    <Section id="logistics-skills" title={t('wiki.logisticsSkills')}>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {skillGroups.map(([index, skills]) => (
          <article key={index} className="min-w-0 space-y-4 rounded-md bg-muted/25 p-3 shadow-[var(--shadow-border)]">
            {skills.map((skill) => {
              const upgrade = detail.logisticsNodes.find((node) => node.index === skill.index && node.level === skill.level)
              return (
                <div key={skill.id} className="relative flex min-w-0 gap-3">
                  {skill.iconId && <AssetIcon path={`/images/wiki/logistics/${skill.iconId}.avif`} alt={localized(skill.name, locale)} />}
                  <div className="min-w-0 flex-1 pb-8">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <h3 className="font-medium">{localized(skill.name, locale)}</h3>
                        <Badge variant="secondary" className="font-geist-mono">Lv.{skill.level}</Badge>
                      </div>
                      <Badge variant="secondary" className="shrink-0">{localized(skill.unlockHint, locale)}</Badge>
                    </div>
                    <WikiRichText value={localized(skill.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
                    {upgrade?.materials.length ? (
                      <div className="absolute bottom-0 right-0">
                        <MaterialDisclosure materials={upgrade.materials} />
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </article>
        ))}
      </div>
    </Section>
  )
}

function CharacterPromotions({ detail }: { detail: WikiCharacterDetail }) {
  const t = useTranslations()
  return (
    <Section id="promotions" title={t('wiki.promotions')}>
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
    <div className="grid min-w-0 items-start gap-3 min-[1280px]:grid-cols-2">
      <div className="min-w-0 overflow-hidden rounded-md shadow-[var(--shadow-border)]">
        <h2 className="bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground">{t('wiki.baseInfo')}</h2>
        <dl className="grid grid-cols-[minmax(5rem,auto)_minmax(0,1fr)] sm:grid-cols-[minmax(5rem,auto)_minmax(0,1fr)_minmax(5rem,auto)_minmax(0,1fr)]">
          {rows.map((row) => (
            <div key={row.label} className="grid min-w-0 grid-cols-subgrid col-span-2 items-center shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.08)]">
              <dt className="px-2 py-2 text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0 break-words px-2 py-2 font-medium text-foreground shadow-[inset_1px_0_0_0_rgba(0,0,0,0.08)]">{row.value || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="min-w-0 overflow-hidden rounded-md shadow-[var(--shadow-border)]">
        <h2 className="bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground">{t('wiki.cv')}</h2>
        <dl className="grid grid-cols-[minmax(5rem,auto)_minmax(0,1fr)] sm:grid-cols-[minmax(5rem,auto)_minmax(0,1fr)_minmax(5rem,auto)_minmax(0,1fr)]">
          {voices.map((voice) => (
            <div key={voice.language} className="grid min-w-0 grid-cols-subgrid col-span-2 items-center shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.08)]">
              <dt className="px-2 py-2 text-muted-foreground">{t(`wiki.voiceLanguages.${voice.language}`)}</dt>
              <dd className="min-w-0 break-words px-2 py-2 font-medium text-foreground shadow-[inset_1px_0_0_0_rgba(0,0,0,0.08)]">{getVoiceActorDisplayName(voice, locale)}</dd>
            </div>
          ))}
        </dl>
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
  const locale = useLocale() as WikiLocale
  const attributes = (wikiEnums as { attributes: Record<string, LocalizedText> }).attributes
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
        meta={
          <div className="min-w-0">
            <CharacterMetaTables
              rows={[
                ...metaRows,
                ...detail.fixedStats.map((stat) => ({
                  label: localized(attributes[stat.attributeId] ?? { 'zh-CN': stat.attributeId, en: stat.attributeId, ja: stat.attributeId, 'zh-TW': stat.attributeId }, locale),
                  value: String(stat.value),
                })),
              ]}
              voices={detail.cvNames}
            />
          </div>
        }
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
        {detail.equipmentNodes.length > 0 && <CharacterEquipmentNodes detail={detail} />}
        <CharacterSkills detail={detail} />
        <CharacterTalents detail={detail} />
        <CharacterPotentials detail={detail} />
        <CharacterLogistics detail={detail} />
        <CharacterPromotions detail={detail} />
      </div>
    </>
  )
}


function WeaponLevelTable({ detail }: { detail: WikiWeaponDetail }) {
  const t = useTranslations()
  const [showAll, setShowAll] = useState(false)
  const levels = useMemo(() => getVisibleWeaponLevels(detail.levels, showAll), [detail.levels, showAll])
  const attackSpans = getAdjacentSpans(levels.map((level) => level.baseAttack))
  return (
    <Section id="level-data" title={t('wiki.levelData')}>
      <WikiTableFrame
        scrollClassName="max-h-[min(60svh,36rem)]"
        className="min-w-[18rem]"
        footer={<LevelToggle showAll={showAll} onToggle={() => setShowAll((value) => !value)} />}
      >
        <WikiTable className="min-w-full table-fixed">
          <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('wiki.level')}</TableHead>
            <TableHead className="text-center">{t('wiki.baseAttack')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{levels.map((level, rowIndex) => (
          <TableRow key={level.level}>
            <TableCell className="font-geist-mono">{level.level}</TableCell>
            {attackSpans[rowIndex] > 0 ? (
              <TableCell rowSpan={attackSpans[rowIndex]} className="relative p-0 text-center align-top font-geist-mono">
                <MergedValue value={level.baseAttack} span={attackSpans[rowIndex]} />
              </TableCell>
            ) : null}
          </TableRow>
        ))}</TableBody>
        </WikiTable>
      </WikiTableFrame>
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
        <Section id="skills" title={t('wiki.skills')}>
          <div className="space-y-5">
            {detail.skills.map((skill) => {
              const showAll = expandedSkillIds.has(skill.id)
              const visibleLevels = getVisibleSkillLevels(skill.levels, showAll)
              return (
                <article key={skill.id} className="min-w-0 rounded-md bg-muted/25 p-3">
                  <h3 className="font-medium">{localized(skill.name, locale)}</h3>
                  <div className="mt-3 space-y-2">
                    {visibleLevels.map((level) => (
                      <div key={level.level} className="min-w-0 rounded-md bg-background p-2.5 shadow-[var(--shadow-border)]">
                        <span className="font-geist-mono text-xs text-muted-foreground">Lv.{level.level}</span>
                        <WikiRichText value={localized(level.description, locale)} className="mt-1 block text-sm leading-relaxed" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-center pt-2">
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
                </article>
              )
            })}
          </div>
        </Section>
        <Section id="breakthroughs" title={t('wiki.breakthroughs')}>
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            {detail.breakthroughs.map((breakthrough) => (
              <article key={breakthrough.stage} className="min-w-0 rounded-md bg-muted/35 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{t('wiki.breakStage')} {breakthrough.stage}</h3>
                  <span className="font-geist-mono text-xs text-muted-foreground">Lv.{breakthrough.requiredLevel}</span>
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
  const { equipmentStatLabel } = useWikiTranslations()
  return (
    <>
      <WikiDetailHero name={name} rarity={rarity} imagePath={`/images/equip/${imageId}.avif`} meta={meta} />
      <div className="mt-5 min-w-0 space-y-4">
        <Section id="stats" title={t('wiki.stats')}>
          <div className="overflow-hidden rounded-md shadow-[var(--shadow-border)]">
            <WikiTable className="table-fixed">
              <TableHeader>
              <TableRow className="bg-muted/35 hover:bg-muted/35">
                <TableHead className="w-[36%]">{t('wiki.stats')}</TableHead>
                {[0, 1, 2, 3].map((level) => <TableHead key={level} className="text-center">+{level}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.stats.map((stat) => {
                const values = statValues(getEquipmentStatValues(stat))
                const spans = getAdjacentSpans(values)
                return (
                  <TableRow key={stat.attributeId}>
                    <TableCell>{stat.attributeId === 'baseAttack' ? t('wiki.baseAttack') : equipmentStatLabel(stat.attributeId)}</TableCell>
                    {values.map((value, level) => spans[level] > 0 ? (
                      <TableCell key={level} colSpan={spans[level]} className="text-center align-middle font-geist-mono">{value}</TableCell>
                    ) : null)}
                  </TableRow>
                )
              })}
            </TableBody>
            </WikiTable>
          </div>
        </Section>
        <Section id="suit-effects" title={t('wiki.suitEffects')}>
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
        <Section id="crafting-materials" title={t('wiki.craftingMaterials')}>
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
