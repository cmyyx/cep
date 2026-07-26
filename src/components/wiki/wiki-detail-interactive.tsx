'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp, ImageOff } from 'lucide-react'
import { RarityStars } from '@/components/shared/rarity-stars'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { FullscreenImageDialogContent } from '@/components/shared/fullscreen-image-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { WikiDetailToc, type WikiTocItem } from '@/components/wiki/wiki-detail-toc'
import { WikiMaterialList } from '@/components/shared/wiki-material-list'
import { useExpandedWikiMaterials } from '@/components/wiki/wiki-material-catalog'
import { WikiRichText } from '@/components/wiki/wiki-rich-text'
import { WikiTable, WikiTableFrame } from '@/components/wiki/wiki-table'
import { useIsMobile } from '@/hooks/use-mobile'
import { withImageCacheVersion } from '@/lib/image-url'
import { cn } from '@/lib/utils'
import {
  easeWikiScroll,
  getAdjacentSpans,
  getVisibleCharacterLevels,
  getVisibleSkillLevels,
  getVisibleWeaponLevels,
  getWidestTableValue,
  unpackCharacterLevels,
  unpackSkillLevels,
  unpackWeaponLevels,
  WIKI_SCROLL_DURATION_MS,
  type CharacterLevelsPacked,
  type SkillLevelsPacked,
  type WeaponLevelsPacked,
} from '@/components/wiki/wiki-detail-utils'

export type { WikiTocItem }

export interface WikiDetailShellProps {
  children: React.ReactNode
  tocItems: WikiTocItem[]
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

export function WikiAssetIcon({ path, alt }: { path: string; alt: string }) {
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

export type MaterialRef = { itemId: string; count: number }

export function MaterialDisclosureClient({ materials }: { materials: MaterialRef[] }) {
  const t = useTranslations()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const expanded = useExpandedWikiMaterials(materials)
  if (!materials.length) return <span className="text-muted-foreground">—</span>

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
        <WikiMaterialList materials={expanded} />
      </TooltipContent>
    </Tooltip>
  )
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

function MergedValue({ value, span }: { value: React.ReactNode; span: number }) {
  return (
    <span className={cn('inline-flex min-h-10 items-center px-2 py-2', span > 1 && 'sticky top-10')}>
      {value}
    </span>
  )
}

export function CharacterLevelTableIsland({
  levels: packedLevels,
  attributeIds,
  attributeLabels,
  title,
}: {
  levels: CharacterLevelsPacked
  attributeIds: string[]
  attributeLabels: Record<string, string>
  title: string
}) {
  const t = useTranslations()
  const [showAll, setShowAll] = useState(false)
  const levels = useMemo(() => unpackCharacterLevels(packedLevels), [packedLevels])
  const visibleLevels = useMemo(() => getVisibleCharacterLevels(levels, showAll), [levels, showAll])
  const levelSizingValue = useMemo(() => getWidestTableValue(levels.map((level) => level.level)), [levels])
  const breakStageSizingValue = useMemo(() => getWidestTableValue(levels.map((level) => level.breakStage)), [levels])
  const attributeSizingValues = useMemo(
    () => attributeIds.map((id) => getWidestTableValue(levels.map((level) => level.stats.find((stat) => stat.attributeId === id)?.value))),
    [attributeIds, levels],
  )
  const breakStageSpans = getAdjacentSpans(visibleLevels.map((level) => level.breakStage))
  const attributeSpans = Object.fromEntries(
    attributeIds.map((id) => [
      id,
      getAdjacentSpans(visibleLevels.map((level) => level.stats.find((stat) => stat.attributeId === id)?.value ?? '—')),
    ]),
  )

  return (
    <section id="level-data" className="scroll-mt-4">
      <div className="min-w-0 gap-3 rounded-xl bg-card py-4 text-card-foreground shadow-[var(--shadow-border)] flex flex-col">
        <div className="px-4 font-semibold">{title}</div>
        <div className="px-4">
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
                      {attributeLabels[id] ?? id}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow aria-hidden className="collapse">
                  <TableCell className="font-mono tabular-nums">{levelSizingValue}</TableCell>
                  <TableCell className="text-center font-mono tabular-nums">{breakStageSizingValue}</TableCell>
                  {attributeIds.map((id, index) => (
                    <TableCell key={id} className="text-center font-mono tabular-nums">{attributeSizingValues[index]}</TableCell>
                  ))}
                </TableRow>
                {visibleLevels.map((level, rowIndex) => (
                  <TableRow key={`${level.level}-${level.breakStage}`}>
                    <TableCell className="sticky left-0 z-10 bg-card font-mono tabular-nums">{level.level}</TableCell>
                    {breakStageSpans[rowIndex] > 0 && (
                      <TableCell rowSpan={breakStageSpans[rowIndex]} className="relative p-0 text-center align-top font-mono tabular-nums">
                        <MergedValue value={level.breakStage} span={breakStageSpans[rowIndex]} />
                      </TableCell>
                    )}
                    {attributeIds.map((id) =>
                      attributeSpans[id][rowIndex] > 0 ? (
                        <TableCell key={id} rowSpan={attributeSpans[id][rowIndex]} className="relative p-0 text-center align-top font-mono tabular-nums">
                          <MergedValue value={level.stats.find((stat) => stat.attributeId === id)?.value ?? '—'} span={attributeSpans[id][rowIndex]} />
                        </TableCell>
                      ) : null,
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </WikiTable>
          </WikiTableFrame>
        </div>
      </div>
    </section>
  )
}

export function CharacterSkillLevelsIsland({
  skillId,
  metrics,
  levels: packedLevels,
}: {
  skillId: string
  metrics: Array<{ id: string; label: string }>
  levels: SkillLevelsPacked
}) {
  const t = useTranslations()
  const [showAll, setShowAll] = useState(false)
  const levels = useMemo(() => unpackSkillLevels(packedLevels), [packedLevels])
  const visibleLevels = getVisibleSkillLevels(levels, showAll)
  const sizingValues = useMemo(() => ({
    label: getWidestTableValue(levels.map((level) => level.label)),
    metrics: metrics.map((_, index) => getWidestTableValue(levels.map((level) => level.values[index] || '—'))),
    coolDown: getWidestTableValue(levels.map((level) => level.coolDown)),
    costValue: getWidestTableValue(levels.map((level) => level.costValue)),
  }), [metrics, levels])
  const metricSpans = metrics.map((_, index) => getAdjacentSpans(visibleLevels.map((level) => level.values[index] || '—')))
  const coolDownSpans = getAdjacentSpans(visibleLevels.map((level) => level.coolDown ?? '—'))
  const costValueSpans = getAdjacentSpans(visibleLevels.map((level) => level.costValue ?? '—'))

  return (
    <WikiTableFrame
      scrollClassName="overflow-x-auto"
      className="min-w-[36rem]"
      footer={
        <LevelToggle
          showAll={showAll}
          onToggle={() => setShowAll((value) => !value)}
          collapseLabel={t('wiki.collapseSkillLevels')}
          expandLabel={t('wiki.showAllSkillLevels')}
        />
      }
    >
      <WikiTable className="min-w-full">
        <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('wiki.level')}</TableHead>
            {metrics.map((metric) => (
              <TableHead key={metric.id} className="max-w-28 whitespace-normal text-center leading-tight">
                {metric.label}
              </TableHead>
            ))}
            <TableHead className="whitespace-normal text-center leading-tight">{t('wiki.coolDown')}</TableHead>
            <TableHead className="whitespace-normal text-center leading-tight">{t('wiki.skillCost')}</TableHead>
            <TableHead className="text-center">{t('wiki.materials')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleLevels.map((level, rowIndex) => (
            <TableRow key={`${skillId}-${level.level}`}>
              <TableCell className="font-geist-mono" style={{ minWidth: `${sizingValues.label.length + 1}ch` }}>
                {level.label}
              </TableCell>
              {metrics.map((metric, metricIndex) =>
                metricSpans[metricIndex]?.[rowIndex] > 0 ? (
                  <TableCell key={metric.id} rowSpan={metricSpans[metricIndex][rowIndex]} className="relative p-0 text-center align-top font-geist-mono">
                    <MergedValue value={level.values[metricIndex] || '—'} span={metricSpans[metricIndex][rowIndex]} />
                  </TableCell>
                ) : null,
              )}
              {coolDownSpans[rowIndex] > 0 ? (
                <TableCell rowSpan={coolDownSpans[rowIndex]} className="relative p-0 text-center align-top font-geist-mono">
                  <MergedValue value={level.coolDown ?? '—'} span={coolDownSpans[rowIndex]} />
                </TableCell>
              ) : null}
              {costValueSpans[rowIndex] > 0 ? (
                <TableCell rowSpan={costValueSpans[rowIndex]} className="relative p-0 text-center align-top font-geist-mono">
                  <MergedValue value={level.costValue ?? '—'} span={costValueSpans[rowIndex]} />
                </TableCell>
              ) : null}
              <TableCell className="text-center">
                <MaterialDisclosureClient materials={level.materials} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </WikiTable>
    </WikiTableFrame>
  )
}

export function WeaponLevelTableIsland({
  levels: packedLevels,
  title,
}: {
  levels: WeaponLevelsPacked
  title: string
}) {
  const t = useTranslations()
  const [showAll, setShowAll] = useState(false)
  const levels = useMemo(() => unpackWeaponLevels(packedLevels), [packedLevels])
  const visible = useMemo(() => getVisibleWeaponLevels(levels, showAll), [levels, showAll])
  const attackSpans = getAdjacentSpans(visible.map((level) => level.baseAttack))
  return (
    <section id="level-data" className="scroll-mt-4">
      <div className="min-w-0 gap-3 rounded-xl bg-card py-4 text-card-foreground shadow-[var(--shadow-border)] flex flex-col">
        <div className="px-4 font-semibold">{title}</div>
        <div className="px-4">
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
              <TableBody>
                {visible.map((level, rowIndex) => (
                  <TableRow key={level.level}>
                    <TableCell className="font-geist-mono">{level.level}</TableCell>
                    {attackSpans[rowIndex] > 0 ? (
                      <TableCell rowSpan={attackSpans[rowIndex]} className="relative p-0 text-center align-top font-geist-mono">
                        <MergedValue value={level.baseAttack} span={attackSpans[rowIndex]} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </WikiTable>
          </WikiTableFrame>
        </div>
      </div>
    </section>
  )
}

export function WeaponSkillLevelsIsland({
  skillId,
  levels,
}: {
  skillId: string
  levels: Array<{ level: number; description: string }>
}) {
  const t = useTranslations()
  const [showAll, setShowAll] = useState(false)
  const visibleLevels = getVisibleSkillLevels(levels, showAll)
  return (
    <div>
      <div className="mt-3 space-y-2">
        {visibleLevels.map((level) => (
          <div key={`${skillId}-${level.level}`} className="min-w-0 rounded-md bg-background p-2.5 shadow-[var(--shadow-border)]">
            <span className="font-geist-mono text-xs text-muted-foreground">Lv.{level.level}</span>
            <WikiRichText value={level.description} className="mt-1 block text-sm leading-relaxed" />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-center pt-2">
        <LevelToggle
          showAll={showAll}
          onToggle={() => setShowAll((value) => !value)}
          collapseLabel={t('wiki.collapseSkillLevels')}
          expandLabel={t('wiki.showAllSkillLevels')}
        />
      </div>
    </div>
  )
}

export function AdministratorHero({
  name,
  rarity,
  meta,
  femaleImage,
  maleImage,
  femaleLabel,
  maleLabel,
  switchToFemaleLabel,
  switchToMaleLabel,
}: {
  name: string
  rarity: number
  meta: React.ReactNode
  femaleImage: string
  maleImage: string
  femaleLabel: string
  maleLabel: string
  /** Accessible name describing the action the switch performs next. */
  switchToFemaleLabel?: string
  switchToMaleLabel?: string
}) {
  const [variant, setVariant] = useState<'female' | 'male'>('female')
  const imageId = variant === 'female' ? femaleImage : maleImage
  // A fixed label would announce the same thing in both states; describe the next action.
  const switchLabel = variant === 'female'
    ? switchToMaleLabel ?? maleLabel
    : switchToFemaleLabel ?? femaleLabel
  return (
    <WikiDetailHero
      name={name}
      rarity={rarity}
      imagePath={`/images/characters/full/${imageId}.avif`}
      imageClassName="object-contain object-bottom"
      meta={meta}
      actions={
        <div className="flex items-center gap-2 text-xs">
          <span>{variant === 'female' ? femaleLabel : maleLabel}</span>
          <Switch
            checked={variant === 'male'}
            onCheckedChange={(checked) => setVariant(checked ? 'male' : 'female')}
            aria-label={switchLabel}
          />
        </div>
      }
    />
  )
}

export function PotentialImageDialog({
  name,
  imagePath,
  openLabel,
}: {
  name: string
  imagePath: string
  openLabel: string
}) {
  const t = useTranslations()
  const [failed, setFailed] = useState(false)
  if (failed) {
    // Missing artwork must not leave an empty clickable box.
    return (
      <span
        role="img"
        aria-label={name}
        className="flex aspect-[2/1] w-full max-w-72 items-center justify-center rounded-md bg-muted/50 text-muted-foreground shadow-[var(--shadow-border)]"
      >
        <ImageOff className="size-5" />
      </span>
    )
  }
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="relative aspect-[2/1] h-auto w-full max-w-72 overflow-hidden rounded-md bg-muted/50 p-0 shadow-[var(--shadow-border)] hover:bg-muted/70"
            aria-label={openLabel}
          />
        }
      >
        <Image
          src={withImageCacheVersion(imagePath)}
          alt={name}
          fill
          unoptimized
          sizes="288px"
          className="object-contain"
          onError={() => setFailed(true)}
        />
      </DialogTrigger>
      <FullscreenImageDialogContent
        src={withImageCacheVersion(imagePath)}
        alt={name}
        title={name}
        closeLabel={t('wiki.closePreview')}
      />
    </Dialog>
  )
}
