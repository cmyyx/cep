/* eslint-disable react-hooks/immutability */
'use client'

import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEditorStore } from '@/stores/useEditorStore'
import type { EditorDraftCharacter } from '@/stores/useEditorStore'
import { cn } from '@/lib/utils'

const STAT_KEYS = [
  { key: 'strength' as const, labelKey: 'charGuide.stat_strength' },
  { key: 'agility' as const, labelKey: 'charGuide.stat_agility' },
  { key: 'intellect' as const, labelKey: 'charGuide.stat_intellect' },
  { key: 'will' as const, labelKey: 'charGuide.stat_will' },
  { key: 'attack' as const, labelKey: 'charGuide.stat_attack' },
  { key: 'hp' as const, labelKey: 'charGuide.stat_hp' },
]

export type EditorBasicTabProps = {
  draft: EditorDraftCharacter
}

export function EditorBasicTab({ draft }: EditorBasicTabProps) {
  const t = useTranslations()
  const markDirty = useEditorStore((s) => s.markDirty)
  const setSelectedId = useEditorStore((s) => s.setSelectedId)
  const allDrafts = useEditorStore((s) => s.draftCharacters)

  // Local ID state — tracks what the user sees in the input.
  // Only committed to draft.id when it's valid (no collision).
  const [localId, setLocalId] = useState(draft.id)

  // Sync localId when the draft changes externally (e.g. switching characters)
  const prevDraftRef = useRef(draft)
  useEffect(() => {
    if (prevDraftRef.current !== draft) {
      setLocalId(draft.id)
      prevDraftRef.current = draft
    }
  }, [draft])

  // Check if the local ID collides with another draft (not self)
  const idCollision = useMemo(() => {
    const normalized = localId.toLowerCase()
    return allDrafts.find(
      (c) => c.id.toLowerCase() === normalized && c.id !== draft.id
    )
  }, [localId, allDrafts, draft.id])

  // Commit ID to draft only when it's valid (unique)
  const commitId = useCallback(
    (newId: string) => {
      const normalized = newId.toLowerCase()
      if (!normalized) return false // don't commit empty
      const collision = allDrafts.find(
        (c) => c.id.toLowerCase() === normalized && c.id !== draft.id
      )
      if (collision) return false
      const oldId = draft.id
      ;(draft as unknown as Record<string, unknown>)['id'] = normalized
      if (normalized !== oldId) {
        setSelectedId(normalized)
      }
      markDirty(normalized)
      return true
    },
    [draft, allDrafts, setSelectedId, markDirty]
  )

  const handleIdChange = useCallback(
    (value: string) => {
      // Only allow lowercase letters a-z
      const filtered = value.replace(/[^a-zA-Z]/g, '').toLowerCase()
      setLocalId(filtered)
      commitId(filtered)
    },
    [commitId]
  )

  const updateField = useCallback(
    (field: string, value: string | number) => {
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
            value={localId}
            onChange={(e) => handleIdChange(e.target.value)}
            className={cn('h-8 text-sm font-geist-mono', idCollision && 'border-ship-red ring-1 ring-ship-red/30')}
            placeholder={t('editor.placeholderCharacterId')}
            pattern="[a-z]+"
            autoComplete="off"
            spellCheck={false}
          />
          {idCollision && (
            <p className="text-[10px] text-ship-red leading-tight">
              {t('editor.idDuplicate', { existing: idCollision.name || idCollision.id })}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldName')}</Label>
          <Input
            value={draft.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="h-8 text-sm"
            placeholder={t('editor.placeholderCharacterName')}
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
        <Label className="text-xs mb-2 block">{t('charGuide.skills')} — {t('charGuide.stats')}</Label>
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
}
