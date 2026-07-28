'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Calculator, Clock3, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { useGrowthPlannerStore } from '@/stores/useGrowthPlannerStore'
import { calculateGrowthRequirements, estimateFarming, PLANNER_RESOURCE_IDS } from '@/lib/planner/progression'
import { getPlannerGameData } from '@/lib/planner/planner-data-loader'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import type { MaterialRequirement } from '@/types/planner'
import type { WikiLocale } from '@/types/wiki'

const TILE_CLASS = 'min-w-0 rounded-xl bg-develop-blue/8 p-3 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-develop-blue)_15%,transparent)] sm:p-4'
const TILE_VALUE_CLASS = 'mt-3 truncate font-mono text-xl font-semibold tabular-nums tracking-[-0.4px] sm:mt-4 sm:text-2xl sm:tracking-[-0.8px] xl:text-3xl xl:tracking-[-1.2px]'
const TILE_LABEL_CLASS = 'truncate text-xs text-muted-foreground'
export const GROWTH_MOBILE_RESOURCE_ROW_CLASS = 'grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 p-3'
export const GROWTH_MOBILE_STATS_CLASS = 'col-span-2 mt-1.5 flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs'

export function GrowthSummary() {
  const t = useTranslations('growthPlanner')
  const locale = useLocale() as WikiLocale
  // Rendered behind the page's usePlannerData() gate, so the cache is populated.
  const plannerGameData = getPlannerGameData()
  const configs = useGrowthPlannerStore((state) => state.configs)
  const result = calculateGrowthRequirements(configs)
  const farming = estimateFarming(result)
  const { itemName, text } = useWikiTranslations()
  const number = new Intl.NumberFormat(locale)
  // Locale-aware enumeration separator: "、" is only correct for zh/ja.
  const list = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' })
  const resources: MaterialRequirement[] = [
    { itemId: PLANNER_RESOURCE_IDS.stageOneExp, count: result.stageOneExp },
    { itemId: PLANNER_RESOURCE_IDS.stageTwoExp, count: result.stageTwoExp },
    { itemId: PLANNER_RESOURCE_IDS.weaponExp, count: result.weaponExp },
    { itemId: PLANNER_RESOURCE_IDS.gold, count: result.gold },
    ...result.materials,
  ].filter((entry) => entry.count > 0)
  const stageFor = (itemId: string) => farming.stages.find((stage) => stage.requirements.some((entry) => entry.itemId === itemId))
  const orderedResources = [...resources].sort((left, right) => Number(Boolean(stageFor(right.itemId))) - Number(Boolean(stageFor(left.itemId))))
  // Precompute per-resource display data once; both the table (≥lg) and
  // the card stack (<lg) consume the same values.
  const resourceDisplays = orderedResources.map((resource) => {
    const stage = stageFor(resource.itemId)
    const output = stage?.dungeon.yields.find(([itemId]) => itemId === resource.itemId)?.[1] ?? 0
    const rewardCards = stage?.dungeon.rewardItems.filter(([itemId]) => itemId.includes('expcard')) ?? []
    const expValue = plannerGameData.materials[resource.itemId]?.expValue
    return {
      resource,
      stage,
      output,
      displayName: itemName(resource.itemId),
      rewardCards,
      expValue,
      convertedCount: expValue ? Math.ceil(resource.count / expValue) : undefined,
    }
  })

  if (configs.length === 0) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl bg-muted/35 px-8 text-center shadow-[var(--shadow-border)]">
        <Calculator className="size-8 text-develop-blue" />
        <div><h2 className="font-medium">{t('emptyTitle')}</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">{t('emptyDescription')}</p></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* min-w-0 + responsive type: three tiles must survive a 360px viewport
          without the six-digit run counts being clipped by overflow-hidden. */}
      <section className="grid grid-cols-3 gap-2">
        <div className={TILE_CLASS}><Clock3 className="size-4 text-develop-blue" /><div className={TILE_VALUE_CLASS}>{number.format(farming.totalRuns)}</div><div className={TILE_LABEL_CLASS}>{t('totalRuns')}</div></div>
        <div className={TILE_CLASS}><Zap className="size-4 text-develop-blue" /><div className={TILE_VALUE_CLASS}>{number.format(farming.totalStamina)}</div><div className={TILE_LABEL_CLASS}>{t('totalStamina')}</div></div>
        <div className={TILE_CLASS}><Calculator className="size-4 text-develop-blue" /><div className={TILE_VALUE_CLASS}>{number.format(configs.length)}</div><div className={TILE_LABEL_CLASS}>{t('targetCount')}</div></div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><h2 className="text-lg font-semibold tracking-[-0.4px]">{t('resourceDifference')}</h2><Badge variant="secondary">{resources.length}</Badge></div>
        {/* Desktop (≥lg): scrollable table. Narrow viewports use the compact
            list below so stamina/runs are never clipped off-screen. */}
        <div className="hidden overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)] lg:block">
          <Table className="min-w-[54rem]">
            <TableHeader><TableRow><TableHead>{t('resource')}</TableHead><TableHead>{t('requiredQuantity')}</TableHead><TableHead>{t('farmStage')}</TableHead><TableHead>{t('yieldPerRun')}</TableHead><TableHead>{t('runsLabel')}</TableHead><TableHead>{t('staminaLabel')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {resourceDisplays.map((display) => <TableRow key={display.resource.itemId}>
                <TableCell className="min-w-0"><div className="flex min-w-0 items-center gap-2"><RarityFrame imageSrc={`/images/items/${plannerGameData.materials[display.resource.itemId]?.iconId ?? display.resource.itemId}.avif`} title={display.displayName} rarity={plannerGameData.materials[display.resource.itemId]?.rarity ?? 1} showTitle={false} imageClassName="object-contain p-1" className="size-10 shrink-0 rounded-md" /><span className="min-w-0 truncate font-medium">{display.displayName}</span></div></TableCell>
                <TableCell className="font-mono font-semibold tabular-nums"><span className="block">{number.format(display.resource.count)}{display.expValue ? <span className="ml-1 text-xs font-normal text-muted-foreground">EXP</span> : null}</span>{display.convertedCount ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{t('equivalentItems', { count: number.format(display.convertedCount) })}</span> : null}</TableCell>
                <TableCell className="whitespace-normal">{display.stage ? <div><span className="font-medium">{text('dungeon', display.stage.dungeon.seriesId)}</span><div className="mt-0.5 text-xs text-muted-foreground">{text('dungeon', display.stage.dungeon.id)}</div>{display.expValue && display.rewardCards.length > 0 && <div className="mt-1 text-xs text-muted-foreground">{t('rewardCards')}: {list.format(display.rewardCards.map(([itemId, count]) => `${itemName(itemId)} ×${number.format(count)}`))}</div>}</div> : <span className="text-muted-foreground">{t('noFarmableStages')}</span>}</TableCell>
                <TableCell className="font-mono tabular-nums">{display.output ? number.format(display.output) : '—'}</TableCell>
                <TableCell className="font-mono font-semibold tabular-nums">{display.stage ? number.format(display.stage.runs) : '—'}</TableCell>
                <TableCell className="font-mono font-semibold tabular-nums">{display.stage ? number.format(display.stage.stamina) : '—'}</TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </div>
        {/* Mobile (<lg): compact list. Each resource is one tight row.
            Value block (right-aligned, under the name) stacks the count + a
            smaller "折合xx个" line beneath it — together about as tall as the
            old single EXP line. Farmable resources add stage + a wrapped
            产出/次数/理智 row beneath the icon. No card chrome. */}
        <div className="space-y-0 divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)] lg:hidden">
          {resourceDisplays.map((display) => {
            const icon = `/images/items/${plannerGameData.materials[display.resource.itemId]?.iconId ?? display.resource.itemId}.avif`
            const rarity = plannerGameData.materials[display.resource.itemId]?.rarity ?? 1
            return (
              <div key={display.resource.itemId} data-growth-mobile-resource-row className={GROWTH_MOBILE_RESOURCE_ROW_CLASS}>
                <RarityFrame imageSrc={icon} title={display.displayName} rarity={rarity} showTitle={false} imageClassName="object-contain p-1" className="size-10 shrink-0 rounded-md" />
                <div className="min-w-0">
                  {/* Line 1: name fills the width, value block right-aligned. The value
                      group stacks count(+EXP) over the smaller 折合xx个 line, kept
                      nowrap and shrink-0 so it never wraps onto the name line. */}
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 self-center truncate font-medium">{display.displayName}</span>
                    <span className="flex shrink-0 flex-col items-end leading-tight">
                      <span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums">
                        {number.format(display.resource.count)}
                        {display.expValue ? <span className="ml-0.5 text-xs font-normal text-muted-foreground">EXP</span> : null}
                      </span>
                      {display.convertedCount ? (
                        <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                          {t('equivalentItems', { count: number.format(display.convertedCount) })}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {display.stage ? (
                    <div className="mt-1.5 space-y-1">
                      <div className="text-sm">
                        <span className="font-medium">{text('dungeon', display.stage.dungeon.seriesId)}</span>
                        <span className="ml-1 text-muted-foreground">{text('dungeon', display.stage.dungeon.id)}</span>
                      </div>
                      {display.expValue && display.rewardCards.length > 0 ? (
                        <p className="text-[11px] text-muted-foreground">{t('rewardCards')}: {list.format(display.rewardCards.map(([itemId, count]) => `${itemName(itemId)} ×${number.format(count)}`))}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {display.stage ? (
                  <div data-growth-mobile-stats className={GROWTH_MOBILE_STATS_CLASS}>
                    <span className="text-muted-foreground">{t('yieldPerRun')} <span className="font-mono font-medium tabular-nums text-foreground">{display.output ? number.format(display.output) : '—'}</span></span>
                    <span className="text-muted-foreground">{t('runsLabel')} <span className="font-mono font-semibold tabular-nums text-foreground">{number.format(display.stage.runs)}</span></span>
                    <span className="text-muted-foreground">{t('staminaLabel')} <span className="font-mono font-semibold tabular-nums text-foreground">{number.format(display.stage.stamina)}</span></span>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
