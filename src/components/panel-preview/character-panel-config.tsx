'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { wikiCharacters } from '@/generated/data/wiki/characters'
import { plannerGameData } from '@/generated/data/planner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NumberField } from '@/components/shared/number-field'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { WikiEntityPicker } from '@/components/shared/wiki-entity-picker'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import { usePanelPreviewStore } from '@/stores/usePanelPreviewStore'

const SKILL_TYPE_KEYS: Record<string, string> = {
  '0': 'normalAttack',
  '1': 'battleSkill',
  '2': 'ultimate',
  '3': 'comboSkill',
}

export function CharacterPanelConfig() {
  const t = useTranslations('panelPreview')
  const { entityName, text } = useWikiTranslations()
  const [pickerOpen, setPickerOpen] = useState(false)
  const config = usePanelPreviewStore((state) => state.config)
  const setCharacter = usePanelPreviewStore((state) => state.setCharacter)
  const updateConfig = usePanelPreviewStore((state) => state.updateConfig)
  const summary = config ? wikiCharacters.find((entry) => entry.id === config.characterId) : undefined
  const data = config ? plannerGameData.characters[config.characterId] : undefined
  const name = summary ? entityName(summary) : t('chooseOperator')

  return (
    <section className="space-y-4">
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogTrigger render={<Button type="button" variant="ghost" size="card" className="h-auto min-h-24 w-full justify-start gap-3 rounded-lg p-3 shadow-[var(--shadow-border)]" />}>
          {summary ? <RarityFrame imageSrc={`/images/characters/${summary.imageId}.avif`} backgroundSrc="/images/character-frame-bg.png" title={name} rarity={summary.rarity} showTitle={false} imageClassName="object-cover" className="size-20 rounded-lg" /> : <span className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-muted/50 shadow-[var(--shadow-border)]"><Plus className="size-5" /></span>}
          <span className="min-w-0"><span className="block truncate font-medium">{name}</span><span className="mt-1 block text-xs text-muted-foreground">{summary ? t('changeOperator') : t('chooseOperator')}</span></span>
        </DialogTrigger>
        <DialogContent className="h-[min(90svh,58rem)] sm:max-w-[min(94vw,90rem)] grid-rows-[auto_minmax(0,1fr)]">
          <div><DialogTitle>{t('chooseOperator')}</DialogTitle><DialogDescription className="sr-only">{t('chooseOperatorDescription')}</DialogDescription></div>
          <WikiEntityPicker title={t('operators')} entities={wikiCharacters} imageBasePath="/images/characters" selectedIds={config ? [config.characterId] : []} onSelect={(entity) => { setCharacter(entity.id); setPickerOpen(false) }} className="overflow-hidden" gridClassName="min-h-0 flex-1 overflow-y-auto pr-1" selectionTone="preview" filters={[
            { field: 'rarity', labelKey: 'wiki.filter.rarity' },
            { field: 'elementId', labelKey: 'wiki.filter.element', enumGroup: 'elements' },
            { field: 'professionId', labelKey: 'wiki.filter.profession', enumGroup: 'professions' },
            { field: 'weaponTypeId', labelKey: 'wiki.filter.weaponType', enumGroup: 'weaponTypes' },
          ]} />
        </DialogContent>
      </Dialog>

      {config && data && <div className="space-y-4 rounded-lg bg-muted/25 p-4 shadow-[var(--shadow-border)]">
        <div className="grid grid-cols-[1fr_6rem] items-center gap-3"><Label>{text('ui', 'operatorLevel')}</Label><NumberField value={config.level} minimum={1} maximum={data.levels.at(-1)?.level ?? 90} ariaLabel={text('ui', 'operatorLevel')} onValueChange={(value) => updateConfig({ level: value })} /></div>
        {data.skills.map((skill, index) => {
          const skillName = text('character', config.characterId, 'skill', skill.id, 'name')
          const typeName = text('ui', SKILL_TYPE_KEYS[skill.typeId] ?? 'battleSkill')
          return <div key={skill.id} className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3"><div className="min-w-0"><p className="truncate text-sm">{skillName}</p><p className="text-[11px] text-muted-foreground">{typeName}</p></div><NumberField value={config.skillLevels[index] ?? skill.maxLevel} minimum={1} maximum={skill.maxLevel} ariaLabel={`${typeName} ${skillName}`} onValueChange={(value) => { const skillLevels = [...config.skillLevels]; skillLevels[index] = value; updateConfig({ skillLevels }) }} /></div>
        })}
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3"><Label>{text('ui', 'talent')}</Label><NumberField value={config.talentCount} minimum={0} maximum={data.talents.length} ariaLabel={text('ui', 'talent')} onValueChange={(value) => updateConfig({ talentCount: value })} /></div>
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3"><Label>{text('ui', 'attributeIncrease')}</Label><NumberField value={config.attributeNodeCount} minimum={0} maximum={data.attributeNodes.length} ariaLabel={text('ui', 'attributeIncrease')} onValueChange={(value) => updateConfig({ attributeNodeCount: value })} /></div>
      </div>}
    </section>
  )
}
