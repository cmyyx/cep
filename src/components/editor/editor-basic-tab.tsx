'use client'

import { memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEditorStore } from '@/stores/useEditorStore'
import type { EditorDraftCharacter } from '@/stores/useEditorStore'

const STAT_KEYS = [
  { key: 'strength' as const, labelKey: 'charGuide.stat_strength' },
  { key: 'agility' as const, labelKey: 'charGuide.stat_agility' },
  { key: 'intellect' as const, labelKey: 'charGuide.stat_intellect' },
  { key: 'will' as const, labelKey: 'charGuide.stat_will' },
  { key: 'attack' as const, labelKey: 'charGuide.stat_attack' },
  { key: 'hp' as const, labelKey: 'charGuide.stat_hp' },
]

export const EditorBasicTab = memo(function EditorBasicTab({
  draft,
}: {
  draft: EditorDraftCharacter
}) {
  const t = useTranslations()
  const markDirty = useEditorStore((s) => s.markDirty)

  const updateField = useCallback(
    (field: string, value: string | number) => {
      // Mutate draft directly (editor store holds the reference)
      ;(draft as unknown as Record<string, unknown>)[field] = value
      markDirty(draft.id)
    },
    [draft, markDirty]
  )

  const updateStat = useCallback(
    (key: string, value: string) => {
      draft.stats[key as keyof typeof draft.stats] = value
      markDirty(draft.id)
    },
    [draft, markDirty]
  )

  return (
    <div className="max-w-lg space-y-4">
      <h3 className="text-sm font-semibold tracking-tight">{t('editor.tabBasic')}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldId')}</Label>
          <Input
            value={draft.id}
            onChange={(e) => updateField('id', e.target.value.toLowerCase())}
            className="h-8 text-sm"
            placeholder="character-id"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldName')}</Label>
          <Input
            value={draft.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="h-8 text-sm"
            placeholder="角色名称"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldRarity')}</Label>
          <Input
            type="number"
            min={1}
            max={6}
            value={draft.rarity}
            onChange={(e) => updateField('rarity', Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldElement')}</Label>
          <Input
            value={draft.element}
            onChange={(e) => updateField('element', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldWeaponType')}</Label>
          <Input
            value={draft.weaponType}
            onChange={(e) => updateField('weaponType', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldMainAbility')}</Label>
          <Input
            value={draft.mainAbility}
            onChange={(e) => updateField('mainAbility', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldSubAbility')}</Label>
          <Input
            value={draft.subAbility}
            onChange={(e) => updateField('subAbility', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldProfession')}</Label>
          <Input
            value={draft.profession}
            onChange={(e) => updateField('profession', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Stats */}
      <div>
        <Label className="text-xs mb-2 block">{t('charGuide.skills')} — Stats</Label>
        <div className="grid grid-cols-3 gap-2">
          {STAT_KEYS.map(({ key, labelKey }) => (
            <div key={key} className="space-y-1">
              <span className="text-[11px] text-muted-foreground">{t(labelKey)}</span>
              <Input
                value={draft.stats[key] || ''}
                onChange={(e) => updateStat(key, e.target.value)}
                className="h-7 text-sm"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
