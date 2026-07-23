'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { UserRound, Zap } from 'lucide-react'
import { wikiCharacters } from '@/generated/data/wiki/characters'
import { wikiWeapons } from '@/generated/data/wiki/weapons'
import { Button } from '@/components/ui/button'
import { WikiEntityPicker } from '@/components/shared/wiki-entity-picker'
import { useGrowthPlannerStore } from '@/stores/useGrowthPlannerStore'
import type { WikiEntitySummary } from '@/types/wiki'

type PickerKind = 'characters' | 'weapons'

interface GrowthEntityPickerProps {
  onEntityAdded?: (id: string) => void
}

export function GrowthEntityPicker({ onEntityAdded }: GrowthEntityPickerProps) {
  const t = useTranslations('growthPlanner')
  const [activeKind, setActiveKind] = useState<PickerKind>('characters')
  const configs = useGrowthPlannerStore((state) => state.configs)
  const addEntity = useGrowthPlannerStore((state) => state.addEntity)
  const removeEntity = useGrowthPlannerStore((state) => state.removeEntity)
  const selectedIds = configs.map((config) => config.id)
  const select = (entity: WikiEntitySummary) => {
    if (selectedIds.includes(entity.id)) {
      removeEntity(entity.id)
      return
    }
    addEntity(entity.category === 'characters' ? 'character' : 'weapon', entity.id)
    onEntityAdded?.(entity.id)
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <Button type="button" variant={activeKind === 'characters' ? 'secondary' : 'ghost'} aria-pressed={activeKind === 'characters'} onClick={() => setActiveKind('characters')}><UserRound />{t('operators')}</Button>
        <Button type="button" variant={activeKind === 'weapons' ? 'secondary' : 'ghost'} aria-pressed={activeKind === 'weapons'} onClick={() => setActiveKind('weapons')}><Zap />{t('weapons')}</Button>
      </div>
      {activeKind === 'characters' ? <WikiEntityPicker title={t('operators')} entities={wikiCharacters} imageBasePath="/images/characters" selectedIds={selectedIds} onSelect={select} className="min-h-0 min-w-0 flex-1" gridClassName="min-h-0 flex-1 overflow-y-auto px-1" selectionTone="amber" filters={[
        { field: 'rarity', labelKey: 'wiki.filter.rarity' },
        { field: 'elementId', labelKey: 'wiki.filter.element', enumGroup: 'elements' },
        { field: 'professionId', labelKey: 'wiki.filter.profession', enumGroup: 'professions' },
        { field: 'weaponTypeId', labelKey: 'wiki.filter.weaponType', enumGroup: 'weaponTypes' },
      ]} /> : <WikiEntityPicker title={t('weapons')} entities={wikiWeapons} imageBasePath="/images/weapon" selectedIds={selectedIds} onSelect={select} className="min-h-0 min-w-0 flex-1" gridClassName="min-h-0 flex-1 overflow-y-auto px-1" selectionTone="amber" filters={[
        { field: 'rarity', labelKey: 'wiki.filter.rarity' },
        { field: 'weaponTypeId', labelKey: 'wiki.filter.weaponType', enumGroup: 'weaponTypes' },
      ]} />}
    </div>
  )
}
