'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { wikiEquipment } from '@/generated/data/wiki/equipment'
import { wikiWeapons } from '@/generated/data/wiki/weapons'
import { plannerGameData } from '@/generated/data/planner'
import { weapons } from '@/data/weapons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { NumberField } from '@/components/shared/number-field'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { WikiEntityPicker } from '@/components/shared/wiki-entity-picker'
import { PlannerWikiPreview } from '@/components/shared/planner-wiki-preview'
import { WikiRichText } from '@/components/wiki/wiki-rich-text'
import { EquipmentSuitPicker } from '@/components/panel-preview/equipment-suit-picker'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import { getWeaponWikiPreview } from '@/lib/weapon-wiki-preview'
import { weaponStatLabel } from '@/lib/weapon-stats'
import { createPanelEquipmentSelection, usePanelPreviewStore } from '@/stores/usePanelPreviewStore'
import type { PanelEquipmentSelection, PanelPreviewConfig } from '@/types/planner'
import type { WikiEntitySummary, WikiLocale } from '@/types/wiki'

const EQUIPMENT_FIELDS = ['armor', 'gloves', 'accessoryOne', 'accessoryTwo'] as const
type EquipmentField = typeof EQUIPMENT_FIELDS[number]
type PickerTarget = 'weapon' | EquipmentField | null


export function EquipmentWeaponConfig() {
  const t = useTranslations('panelPreview')
  const allT = useTranslations()
  const locale = useLocale() as WikiLocale
  const { entityName, equipmentStatLabel, text } = useWikiTranslations()
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const [picker, setPicker] = useState<PickerTarget>(null)
  const config = usePanelPreviewStore((state) => state.config)
  const updateConfig = usePanelPreviewStore((state) => state.updateConfig)
  if (!config) return null

  const equipmentLabels: Record<EquipmentField, string> = { armor: t('armor'), gloves: t('gloves'), accessoryOne: t('accessoryOne'), accessoryTwo: t('accessoryTwo') }
  const partTypeByField: Record<EquipmentField, string> = { armor: '0', gloves: '1', accessoryOne: '2', accessoryTwo: '2' }
  const weapon = config.weaponId ? plannerGameData.weapons[config.weaponId] : undefined
  const weaponSummary = config.weaponId ? wikiWeapons.find((entry) => entry.id === config.weaponId) : undefined
  const setEquipment = (field: EquipmentField, value: PanelEquipmentSelection) => updateConfig({ [field]: value } as Pick<PanelPreviewConfig, EquipmentField>)
  const selectWeapon = (entity: WikiEntitySummary) => {
    if (entity.category !== 'weapons') return
    const selected = plannerGameData.weapons[entity.id]
    updateConfig({ weaponId: entity.id, weaponLevel: selected?.levels.at(-1)?.level ?? 90, weaponSkillLevels: selected?.skills.map((skill) => skill.levels.at(-1)?.level ?? 1) ?? [] })
    setPicker(null)
  }
  const renderWeaponTooltip = (entity: WikiEntitySummary) => {
    if (entity.category !== 'weapons') return null
    const source = weapons.find((entry) => entry.id === entity.id)
    const preview = getWeaponWikiPreview(entity.id, locale)
    if (!source) return null
    return <PlannerWikiPreview title={entityName(entity)} rarity={entity.rarity} compact levelOneLabel={preview.levelOneLabel} maxLevelLabel={preview.maxLevelLabel} rows={[
      { label: weaponStatLabel(source.primaryStat, allT), ...preview.values[0] },
      { label: weaponStatLabel(source.elementalDamage, allT), ...preview.values[1] },
      { label: weaponStatLabel(source.specialAbility, allT), ...preview.values[2], truncate: true },
    ].filter((_, index) => [source.primaryStat, source.elementalDamage, source.specialAbility][index] !== null)} wikiHref={preview.wikiHref} />
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-3 p-3">
          <Button type="button" variant="ghost" size="card" className="h-auto min-w-0 flex-1 justify-start gap-3 text-left" onClick={() => setPicker('weapon')}>
            {weaponSummary ? <RarityFrame imageSrc={`/images/weapon/${weaponSummary.imageId}.avif`} title={entityName(weaponSummary)} rarity={weaponSummary.rarity} showTitle={false} imageClassName="object-contain p-2" className="size-20 rounded-lg" /> : <span className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-muted/50 shadow-[var(--shadow-border)]"><Plus className="size-5" /></span>}
            <span className="min-w-0"><span className="block truncate font-medium">{weaponSummary ? entityName(weaponSummary) : t('chooseWeapon')}</span><span className="mt-1 block text-xs text-muted-foreground">{weaponSummary ? t('changeWeapon') : t('chooseWeapon')}</span></span>
          </Button>
          {weaponSummary ? <Button type="button" variant="ghost" size="icon-sm" aria-label={t('removeWeapon')} onClick={() => updateConfig({ weaponId: null, weaponSkillLevels: [] })}><X /></Button> : null}
        </div>
        {weapon && weaponSummary ? <div className="space-y-4 bg-muted/20 p-4 shadow-[0_-1px_0_0_rgba(0,0,0,0.08)]">
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3"><span className="text-sm">{t('weaponLevel')}</span><NumberField value={config.weaponLevel} minimum={1} maximum={weapon.levels.at(-1)?.level ?? 90} ariaLabel={t('weaponLevel')} onValueChange={(value) => updateConfig({ weaponLevel: value })} /></div>
          {weapon.skills.map((skill, index) => {
            const selectedLevel = config.weaponSkillLevels[index] ?? 1
            const skillName = text('weapon', weaponSummary.id, 'skill', skill.id, 'name')
            return <div key={skill.id} className="space-y-2 rounded-lg bg-background/70 p-3"><div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-xs font-medium">{skillName}</p><NumberField value={selectedLevel} minimum={1} maximum={skill.levels.at(-1)?.level ?? 1} ariaLabel={skillName} onValueChange={(value) => { const levels = [...config.weaponSkillLevels]; levels[index] = value; updateConfig({ weaponSkillLevels: levels }) }} className="w-20" /></div><WikiRichText value={text('weapon', weaponSummary.id, 'skill', skill.id, 'level', selectedLevel)} className="block text-xs leading-relaxed text-muted-foreground" /></div>
          })}
        </div> : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {EQUIPMENT_FIELDS.map((field) => {
          const selection = config[field]
          const summary = selection.equipmentId ? wikiEquipment.find((entry) => entry.id === selection.equipmentId) : undefined
          const stats = selection.equipmentId ? plannerGameData.equipment[selection.equipmentId] ?? [] : []
          return <section key={field} className="min-w-0 overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
            <div className="flex items-center gap-3 p-3">
              <Button type="button" variant="ghost" size="card" className="h-auto min-w-0 flex-1 justify-start gap-3 text-left" onClick={() => setPicker(field)}>
                {summary ? <RarityFrame imageSrc={`/images/equip/${summary.imageId}.avif`} title={entityName(summary)} rarity={summary.rarity} showTitle={false} imageClassName="object-cover" className="size-14 rounded-lg" /> : <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted/50 shadow-[var(--shadow-border)]"><Plus className="size-4" /></span>}
                <span className="min-w-0"><span className="block text-xs text-muted-foreground">{equipmentLabels[field]}</span><span className="mt-1 block truncate font-medium">{summary ? entityName(summary) : t('chooseEquipment')}</span></span>
              </Button>
              {summary ? <Button type="button" variant="ghost" size="icon-sm" aria-label={t('removeEquipment', { slot: equipmentLabels[field] })} onClick={() => setEquipment(field, createPanelEquipmentSelection(null))}><X /></Button> : null}
            </div>
            {summary ? <div className="space-y-2 bg-muted/20 p-3 shadow-[0_-1px_0_0_rgba(0,0,0,0.08)]">{stats.map((stat, index) => {
              const fixedDefense = stat.attributeId === '3' && stat.values.every((value) => value === stat.values[0])
              const level = selection.statLevels[index] ?? stat.values.length - 1
              const label = stat.attributeId === 'Main' ? text('ui', 'mainAttribute') : stat.attributeId === 'Sub' ? text('ui', 'subAttribute') : equipmentStatLabel(stat.attributeId)
              if (fixedDefense) return <div key={`${stat.attributeId}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-background/70 p-2.5"><p className="min-w-0 truncate text-xs">{label}</p><span className="shrink-0 font-mono text-sm font-medium tabular-nums">+{number.format(stat.values[0] ?? 0)}</span></div>
              return <div key={`${stat.attributeId}-${index}`} className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 rounded-lg bg-background/70 p-2.5"><p className="min-w-0 truncate text-xs">{label}</p><NumberField value={level} minimum={0} maximum={Math.max(0, stat.values.length - 1)} ariaLabel={`${label} ${t('statLevel')}`} onValueChange={(value) => { const statLevels = [...selection.statLevels]; statLevels[index] = value; setEquipment(field, { ...selection, statLevels }) }} /></div>
            })}</div> : null}
          </section>
        })}
      </div>

      <Dialog open={picker !== null} onOpenChange={(open) => { if (!open) setPicker(null) }}>
        <DialogContent className="h-[min(90svh,58rem)] sm:max-w-[min(94vw,90rem)] grid-rows-[auto_minmax(0,1fr)]">
          <div><DialogTitle>{picker === 'weapon' ? t('chooseWeapon') : picker ? equipmentLabels[picker] : t('equipment')}</DialogTitle><DialogDescription className="sr-only">{picker === 'weapon' ? t('chooseWeaponDescription') : t('chooseEquipmentDescription')}</DialogDescription></div>
          {picker === 'weapon' ? <WikiEntityPicker title={t('weaponLibrary')} entities={wikiWeapons} imageBasePath="/images/weapon" selectedIds={config.weaponId ? [config.weaponId] : []} onSelect={selectWeapon} renderTooltip={renderWeaponTooltip} selectionTone="amber" className="overflow-hidden" gridClassName="min-h-0 flex-1 overflow-y-auto px-1" filters={[{ field: 'rarity', labelKey: 'wiki.filter.rarity' }, { field: 'weaponTypeId', labelKey: 'wiki.filter.weaponType', enumGroup: 'weaponTypes' }]} /> : picker ? <EquipmentSuitPicker partTypeId={partTypeByField[picker]} selectedId={config[picker].equipmentId} onSelect={(equipment) => { setEquipment(picker, createPanelEquipmentSelection(equipment.id)); setPicker(null) }} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
