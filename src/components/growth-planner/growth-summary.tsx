'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Calculator, Clock3, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { useGrowthPlannerStore } from '@/stores/useGrowthPlannerStore'
import { calculateGrowthRequirements, estimateFarming, PLANNER_RESOURCE_IDS } from '@/lib/planner/progression'
import { plannerGameData } from '@/generated/data/planner'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import type { MaterialRequirement } from '@/types/planner'
import type { WikiLocale } from '@/types/wiki'

export function GrowthSummary() {
  const t = useTranslations('growthPlanner')
  const locale = useLocale() as WikiLocale
  const configs = useGrowthPlannerStore((state) => state.configs)
  const result = calculateGrowthRequirements(configs)
  const farming = estimateFarming(result)
  const { itemName, text } = useWikiTranslations()
  const number = new Intl.NumberFormat(locale)
  const resources: MaterialRequirement[] = [
    { itemId: PLANNER_RESOURCE_IDS.stageOneExp, count: result.stageOneExp },
    { itemId: PLANNER_RESOURCE_IDS.stageTwoExp, count: result.stageTwoExp },
    { itemId: PLANNER_RESOURCE_IDS.weaponExp, count: result.weaponExp },
    { itemId: PLANNER_RESOURCE_IDS.gold, count: result.gold },
    ...result.materials,
  ].filter((entry) => entry.count > 0)
  const stageFor = (itemId: string) => farming.stages.find((stage) => stage.requirements.some((entry) => entry.itemId === itemId))
  const orderedResources = [...resources].sort((left, right) => Number(Boolean(stageFor(right.itemId))) - Number(Boolean(stageFor(left.itemId))))

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
      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-develop-blue/8 p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-develop-blue)_15%,transparent)]"><Clock3 className="size-4 text-develop-blue" /><div className="mt-4 font-mono text-3xl font-semibold tracking-[-1.2px]">{number.format(farming.totalRuns)}</div><div className="text-xs text-muted-foreground">{t('totalRuns')}</div></div>
        <div className="rounded-xl bg-develop-blue/8 p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-develop-blue)_15%,transparent)]"><Zap className="size-4 text-develop-blue" /><div className="mt-4 font-mono text-3xl font-semibold tracking-[-1.2px]">{number.format(farming.totalStamina)}</div><div className="text-xs text-muted-foreground">{t('totalStamina')}</div></div>
        <div className="rounded-xl bg-develop-blue/8 p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-develop-blue)_15%,transparent)]"><Calculator className="size-4 text-develop-blue" /><div className="mt-4 font-mono text-3xl font-semibold tracking-[-1.2px]">{configs.length}</div><div className="text-xs text-muted-foreground">{t('targetCount')}</div></div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><h2 className="text-lg font-semibold tracking-[-0.4px]">{t('resourceDifference')}</h2><Badge variant="secondary">{resources.length}</Badge></div>
        <div className="overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
          <Table className="min-w-[54rem]">
            <TableHeader><TableRow><TableHead>{t('resource')}</TableHead><TableHead>{t('requiredQuantity')}</TableHead><TableHead>{t('farmStage')}</TableHead><TableHead>{t('yieldPerRun')}</TableHead><TableHead>{t('runsLabel')}</TableHead><TableHead>{t('staminaLabel')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {orderedResources.map((resource) => {
                const stage = stageFor(resource.itemId)
                const output = stage?.dungeon.yields.find(([itemId]) => itemId === resource.itemId)?.[1] ?? 0
                const displayName = itemName(resource.itemId)
                const rewardCards = stage?.dungeon.rewardItems.filter(([itemId]) => itemId.includes('expcard')) ?? []
                const expValue = plannerGameData.materials[resource.itemId]?.expValue
                const convertedCount = expValue ? Math.ceil(resource.count / expValue) : undefined
                return <TableRow key={resource.itemId}>
                  <TableCell className="min-w-0"><div className="flex min-w-0 items-center gap-2"><RarityFrame imageSrc={`/images/items/${plannerGameData.materials[resource.itemId]?.iconId ?? resource.itemId}.avif`} title={displayName} rarity={plannerGameData.materials[resource.itemId]?.rarity ?? 1} showTitle={false} imageClassName="object-contain p-1" className="size-10 shrink-0 rounded-md" /><span className="min-w-0 truncate font-medium">{displayName}</span></div></TableCell>
                  <TableCell className="font-mono font-semibold tabular-nums"><span className="block">{number.format(resource.count)}{expValue ? <span className="ml-1 text-xs font-normal text-muted-foreground">EXP</span> : null}</span>{convertedCount ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{t('equivalentItems', { count: number.format(convertedCount) })}</span> : null}</TableCell>
                  <TableCell className="whitespace-normal">{stage ? <div><span className="font-medium">{text('dungeon', stage.dungeon.seriesId)}</span><div className="mt-0.5 text-xs text-muted-foreground">{text('dungeon', stage.dungeon.id)}</div>{expValue && rewardCards.length > 0 && <div className="mt-1 text-xs text-muted-foreground">{t('rewardCards')}: {rewardCards.map(([itemId, count]) => `${itemName(itemId)} ×${number.format(count)}`).join('、')}</div>}</div> : <span className="text-muted-foreground">{t('noFarmableStages')}</span>}</TableCell>
                  <TableCell className="font-mono tabular-nums">{output ? number.format(output) : '—'}</TableCell>
                  <TableCell className="font-mono font-semibold tabular-nums">{stage ? number.format(stage.runs) : '—'}</TableCell>
                  <TableCell className="font-mono font-semibold tabular-nums">{stage ? number.format(stage.stamina) : '—'}</TableCell>
                </TableRow>
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
