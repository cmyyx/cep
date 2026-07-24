'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import { wikiCharacters } from '@/generated/data/wiki/characters'
import { wikiWeapons } from '@/generated/data/wiki/weapons'
import { plannerGameData } from '@/generated/data/planner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { NumberField } from '@/components/shared/number-field'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { useGrowthPlannerStore } from '@/stores/useGrowthPlannerStore'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import type { CharacterGrowthConfig, GrowthConfig, PlannerCharacterNodeData } from '@/types/planner'

const SKILL_TYPE_KEYS: Record<string, string> = {
  '0': 'normalAttack',
  '1': 'battleSkill',
  '2': 'ultimate',
  '3': 'comboSkill',
}

interface NumberRangeProps {
  label: ReactNode
  ariaLabel?: string
  current: number
  target: number
  minimum: number
  maximum: number
  onCurrentChange: (value: number) => void
  onTargetChange: (value: number) => void
}

function NumberRange({ label, ariaLabel, current, target, minimum, maximum, onCurrentChange, onTargetChange }: NumberRangeProps) {
  const t = useTranslations('growthPlanner')
  const accessibleLabel = ariaLabel ?? (typeof label === 'string' ? label : '')
  return (
    <div className="grid grid-cols-[minmax(5rem,1fr)_4.5rem_1.5rem_4.5rem] items-center gap-1 sm:grid-cols-[minmax(7rem,1fr)_5rem_3rem_5rem] sm:gap-2">
      <div className="min-w-0">{label}</div>
      <NumberField value={current} minimum={minimum} maximum={target} ariaLabel={t('currentValue', { label: accessibleLabel })} onValueChange={onCurrentChange} />
      <span className="text-center text-xs text-muted-foreground">{t('to')}</span>
      <NumberField value={target} minimum={current} maximum={maximum} ariaLabel={t('targetValue', { label: accessibleLabel })} onValueChange={onTargetChange} />
    </div>
  )
}

function GrowthNodes({
  characterId,
  title,
  nodes,
  currentIds,
  targetIds,
  onChange,
  showIndex = false,
}: {
  characterId: string
  title: string
  nodes: PlannerCharacterNodeData[]
  currentIds: string[]
  targetIds: string[]
  onChange: (current: string[], target: string[]) => void
  showIndex?: boolean
}) {
  const t = useTranslations('growthPlanner')
  const { text } = useWikiTranslations()
  const safeCurrentIds = currentIds ?? []
  const safeTargetIds = targetIds ?? []
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
      <div className="grid grid-cols-[minmax(0,1fr)_3.75rem_3.75rem] gap-x-3 rounded-lg bg-muted/35 p-2">
        <span className="px-2 text-[11px] font-medium text-muted-foreground">{t('nodeName')}</span><span className="text-center text-[11px] font-medium text-muted-foreground">{t('current')}</span><span className="text-center text-[11px] font-medium text-muted-foreground">{t('target')}</span>
        {nodes.map((node, index) => {
          const current = safeCurrentIds.includes(node.id)
          const target = safeTargetIds.includes(node.id)
          const label = text('character', characterId, 'plannerNode', node.id, 'name')
          return <div key={node.id} className="col-span-3 grid grid-cols-subgrid items-center rounded-md px-2 py-1.5 hover:bg-background/60">
            <Label className="min-w-0"><span className="block truncate text-xs">{label}</span>{showIndex ? <span className="block text-[11px] text-muted-foreground">{t('nodeNumber', { number: index + 1 })}</span> : null}</Label>
            <div className="flex justify-center"><Checkbox checked={current} aria-label={t('currentValue', { label })} onCheckedChange={(checked) => onChange(checked ? [...new Set([...safeCurrentIds, node.id])] : safeCurrentIds.filter((id) => id !== node.id), checked && !target ? [...new Set([...safeTargetIds, node.id])] : safeTargetIds)} /></div>
            <div className="flex justify-center"><Checkbox checked={target} aria-label={t('targetValue', { label })} onCheckedChange={(checked) => onChange(checked ? safeCurrentIds : safeCurrentIds.filter((id) => id !== node.id), checked ? [...new Set([...safeTargetIds, node.id])] : safeTargetIds.filter((id) => id !== node.id))} /></div>
          </div>
        })}
      </div>
    </section>
  )
}

function CharacterOptions({ config }: { config: CharacterGrowthConfig }) {
  const { text } = useWikiTranslations()
  const updateConfig = useGrowthPlannerStore((state) => state.updateConfig)
  const data = plannerGameData.characters[config.id]
  if (!data) return null
  const updateArray = (field: 'currentSkillLevels' | 'targetSkillLevels', index: number, value: number) => {
    const next = [...config[field]]
    next[index] = value
    updateConfig(config.id, { [field]: next })
  }
  const changeNodes = (currentKey: 'currentTalentIds' | 'currentAttributeNodeIds' | 'currentEquipmentNodeIds' | 'currentLogisticsNodeIds', targetKey: 'targetTalentIds' | 'targetAttributeNodeIds' | 'targetEquipmentNodeIds' | 'targetLogisticsNodeIds') => (current: string[], target: string[]) => updateConfig(config.id, { [currentKey]: current, [targetKey]: target })
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="space-y-2"><h4 className="text-xs font-semibold text-muted-foreground">{text('ui', 'battleSkills')}</h4>{data.skills.map((skill, index) => {
        const skillName = text('character', config.id, 'skill', skill.id, 'name')
        const typeName = text('ui', SKILL_TYPE_KEYS[skill.typeId] ?? 'battleSkill')
        return <NumberRange key={skill.id} label={<><span className="block truncate text-sm">{skillName}</span><span className="block text-[11px] text-muted-foreground">{typeName}</span></>} ariaLabel={`${typeName} ${skillName}`} current={config.currentSkillLevels[index] ?? 1} target={config.targetSkillLevels[index] ?? skill.maxLevel} minimum={1} maximum={skill.maxLevel} onCurrentChange={(value) => updateArray('currentSkillLevels', index, value)} onTargetChange={(value) => updateArray('targetSkillLevels', index, value)} />
      })}</section>
      <div className="space-y-4">
        <GrowthNodes characterId={config.id} title={text('ui', 'talent')} nodes={data.talents} currentIds={config.currentTalentIds} targetIds={config.targetTalentIds} onChange={changeNodes('currentTalentIds', 'targetTalentIds')} showIndex />
        <GrowthNodes characterId={config.id} title={text('ui', 'attributeIncrease')} nodes={data.attributeNodes} currentIds={config.currentAttributeNodeIds} targetIds={config.targetAttributeNodeIds} onChange={changeNodes('currentAttributeNodeIds', 'targetAttributeNodeIds')} showIndex />
        <GrowthNodes characterId={config.id} title={text('ui', 'equipmentAdaptation')} nodes={data.equipmentNodes} currentIds={config.currentEquipmentNodeIds} targetIds={config.targetEquipmentNodeIds} onChange={changeNodes('currentEquipmentNodeIds', 'targetEquipmentNodeIds')} />
        <GrowthNodes characterId={config.id} title={text('ui', 'logisticsSkill')} nodes={data.logisticsNodes} currentIds={config.currentLogisticsNodeIds} targetIds={config.targetLogisticsNodeIds} onChange={changeNodes('currentLogisticsNodeIds', 'targetLogisticsNodeIds')} />
      </div>
    </div>
  )
}

export function GrowthTargetCard({ config, onRemove }: { config: GrowthConfig; onRemove?: () => void }) {
  const t = useTranslations('growthPlanner')
  const { entityName, text } = useWikiTranslations()
  const updateConfig = useGrowthPlannerStore((state) => state.updateConfig)
  const removeEntity = useGrowthPlannerStore((state) => state.removeEntity)
  const summary = config.kind === 'character' ? wikiCharacters.find((entry) => entry.id === config.id) : wikiWeapons.find((entry) => entry.id === config.id)
  if (!summary) return null
  const name = entityName(summary)
  const data = config.kind === 'character' ? plannerGameData.characters[config.id] : plannerGameData.weapons[config.id]
  const maxLevel = data?.levels.at(-1)?.level ?? 90
  const maxBreak = config.kind === 'character' ? plannerGameData.characters[config.id]?.promotions.at(-1)?.breakStage ?? 4 : plannerGameData.weapons[config.id]?.breakthroughs.at(-1)?.stage ?? 4
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-4 rounded-lg bg-muted/35 p-3">
        <RarityFrame imageSrc={`${config.kind === 'character' ? '/images/characters' : '/images/weapon'}/${summary.imageId}.avif`} backgroundSrc={config.kind === 'character' ? '/images/character-frame-bg.png' : undefined} title={name} rarity={summary.rarity} showTitle={false} imageClassName={config.kind === 'weapon' ? 'object-contain p-2' : 'object-cover'} className="size-[4.5rem] rounded-lg" />
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{config.kind === 'character' ? t('operator') : t('weapon')}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => { removeEntity(config.id); onRemove?.() }} aria-label={t('removeTarget')}><Trash2 /></Button>
      </div>
      <div className="grid gap-2 xl:grid-cols-2">
        <NumberRange label={config.kind === 'character' ? text('ui', 'operatorLevel') : t('level')} current={config.currentLevel} target={config.targetLevel} minimum={1} maximum={maxLevel} onCurrentChange={(value) => updateConfig(config.id, { currentLevel: value })} onTargetChange={(value) => updateConfig(config.id, { targetLevel: value })} />
        <NumberRange label={config.kind === 'character' ? text('ui', 'promotion') : t('breakthroughStage')} current={config.currentBreakStage} target={config.targetBreakStage} minimum={0} maximum={maxBreak} onCurrentChange={(value) => updateConfig(config.id, { currentBreakStage: value })} onTargetChange={(value) => updateConfig(config.id, { targetBreakStage: value })} />
      </div>
      {config.kind === 'character' && <CharacterOptions config={config} />}
    </div>
  )
}
