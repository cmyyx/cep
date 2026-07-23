'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { PlannerWikiPreview } from '@/components/shared/planner-wiki-preview'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { wikiEquipment } from '@/generated/data/wiki/equipment'
import { wikiEquipmentPlannerPreviews } from '@/generated/data/wiki/planner-previews'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import type { WikiEquipmentSummary, WikiLocale } from '@/types/wiki'

export interface EquipmentSuitPickerProps {
  partTypeId: string
  selectedId: string | null
  onSelect: (equipment: WikiEquipmentSummary) => void
}

export function EquipmentSuitPicker({ partTypeId, selectedId, onSelect }: EquipmentSuitPickerProps) {
  const t = useTranslations('panelPreview')
  const locale = useLocale() as WikiLocale
  const { entityName, suitName, enumLabel } = useWikiTranslations()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const groups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    const grouped = new Map<string, WikiEquipmentSummary[]>()
    for (const equipment of wikiEquipment) {
      if (equipment.partTypeId !== partTypeId) continue
      if (term && !entityName(equipment).toLocaleLowerCase().includes(term) && !equipment.id.includes(term)) continue
      const key = equipment.suitId ?? '__no-set__'
      grouped.set(key, [...(grouped.get(key) ?? []), equipment])
    }
    return [...grouped.entries()]
      .map(([key, equipment]) => ({
        key,
        label: key === '__no-set__' ? t('noSetEquipment') : suitName(key),
        equipment: equipment.sort((left, right) => right.rarity - left.rarity || entityName(left).localeCompare(entityName(right))),
      }))
      .sort((left, right) => left.key === '__no-set__' ? -1 : right.key === '__no-set__' ? 1 : (right.equipment[0]?.rarity ?? 0) - (left.equipment[0]?.rarity ?? 0) || left.label.localeCompare(right.label))
  }, [entityName, partTypeId, search, suitName, t])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-8" />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {groups.map((group) => {
          const open = expanded.has(group.key)
          return <section key={group.key} className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
            <Button type="button" variant="ghost" className="min-h-11 w-full justify-start gap-2 px-3" aria-expanded={open} onClick={() => setExpanded((current) => {
              const next = new Set(current)
              if (next.has(group.key)) next.delete(group.key)
              else next.add(group.key)
              return next
            })}>
              <ChevronDown className={open ? 'transition-transform' : '-rotate-90 transition-transform'} />
              <span className="min-w-0 flex-1 truncate text-left font-medium">{group.label}</span>
              <Badge variant="secondary">{group.equipment.length}</Badge>
            </Button>
            {open && <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2 p-3 pt-1">
              {group.equipment.map((equipment) => {
                const name = entityName(equipment)
                const selected = equipment.id === selectedId
                const preview = wikiEquipmentPlannerPreviews[equipment.id]
                const previewLabels = preview?.stats[1] ?? preview?.stats[0]
                const card = <Button type="button" variant="ghost" size="card" aria-pressed={selected} aria-label={name} className={selected ? 'relative h-auto min-w-0 rounded-lg p-0 ring-2 ring-preview-pink shadow-[var(--shadow-border)]' : 'relative h-auto min-w-0 rounded-lg p-0 shadow-[var(--shadow-border)]'} onClick={() => onSelect(equipment)}>
                  <RarityFrame imageSrc={`/images/equip/${equipment.imageId}.avif`} title={name} rarity={equipment.rarity} imageClassName="object-cover" className="w-full rounded-lg shadow-none" badges={selected ? <span className="flex size-5 items-center justify-center rounded-full bg-preview-pink text-white"><Check className="size-3" /></span> : undefined} badgeClassName="left-auto right-1.5 top-1.5" />
                </Button>
                return preview ? <Tooltip key={equipment.id}><TooltipTrigger render={card} /><TooltipContent side="top" sideOffset={8} collisionPadding={16} className="max-h-[min(var(--available-height),calc(100svh-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain bg-popover p-3 text-popover-foreground shadow-[var(--shadow-card)]"><PlannerWikiPreview title={name} rarity={equipment.rarity} compact levelOneLabel={previewLabels?.levelOneLabel} maxLevelLabel={previewLabels?.maxLevelLabel} rows={preview.stats.filter((stat) => stat.attributeId !== '3' || stat.levelOne !== stat.maxLevel).map((stat) => ({ label: enumLabel('attributes', stat.attributeId), levelOne: stat.levelOne, maxLevel: stat.maxLevel }))} wikiHref={`/${locale}/wiki/equipment/${equipment.id}`} /></TooltipContent></Tooltip> : card
              })}
            </div>}
          </section>
        })}
      </div>
    </div>
  )
}

export default EquipmentSuitPicker
