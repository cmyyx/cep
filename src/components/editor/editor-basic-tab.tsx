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
  isReadOnly?: boolean
}

export function EditorBasicTab({ draft, isReadOnly }: EditorBasicTabProps) {
  const t = useTranslations()
  const updateDraft = useEditorStore((s) => s.updateDraft)
  const setSelectedId = useEditorStore((s) => s.setSelectedId)

  // Local ID state — tracks what the user sees in the input.
  const [localId, setLocalId] = useState(draft.id)

  // Sync localId only when the draft identity changes (switching characters)
  const prevIdRef = useRef(draft.id)
  useEffect(() => {
    if (prevIdRef.current !== draft.id) {
      setLocalId(draft.id)
      prevIdRef.current = draft.id
    }
  }, [draft.id])

  // Check if the local ID collides with another draft (not self).
  // Reads from the store synchronously to avoid stale-closure issues.
  const idCollision = useMemo(() => {
    const allDrafts = useEditorStore.getState().draftCharacters
    const normalized = localId.toLowerCase()
    return allDrafts.find(
      (c) => c.id.toLowerCase() === normalized && c.id !== draft.id
    )
  }, [localId, draft.id])

  // Commit ID to draft only when valid (unique and non-empty)
  const commitId = useCallback(
    (newId: string) => {
      const normalized = newId.toLowerCase()
      if (!normalized) return false

      const allDrafts = useEditorStore.getState().draftCharacters
      const collision = allDrafts.find(
        (c) => c.id.toLowerCase() === normalized && c.id !== draft.id
      )
      if (collision) return false

      updateDraft(draft.id, (d) => {
        d.id = normalized
      })
      setSelectedId(normalized)
      return true
    },
    [draft.id, updateDraft, setSelectedId]
  )

  const handleIdChange = useCallback(
    (value: string) => {
      // Allow lowercase letters a-z and hyphens
      const filtered = value.replace(/[^a-zA-Z-]/g, '').toLowerCase()
      setLocalId(filtered)
      commitId(filtered)
    },
    [commitId]
  )

  const updateField = useCallback(
    (field: string, value: string | number) => {
      updateDraft(draft.id, (d) => {
        ;(d as unknown as Record<string, unknown>)[field] = value
      })
    },
    [draft.id, updateDraft]
  )

  const updateStat = useCallback(
    (key: string, value: string) => {
      updateDraft(draft.id, (d) => {
        d.stats[key as keyof typeof d.stats] = value
      })
    },
    [draft.id, updateDraft]
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
            pattern="[a-z-]+"
            autoComplete="off"
            spellCheck={false}
            readOnly={isReadOnly}
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
            readOnly={isReadOnly}
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
            readOnly={isReadOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldElement')}</Label>
          <Input
            value={draft.element}
            onChange={(e) => updateField('element', e.target.value)}
            className="h-8 text-sm"
            readOnly={isReadOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldWeaponType')}</Label>
          <Input
            value={draft.weaponType}
            onChange={(e) => updateField('weaponType', e.target.value)}
            className="h-8 text-sm"
            readOnly={isReadOnly}
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
            readOnly={isReadOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldSubAbility')}</Label>
          <Input
            value={draft.subAbility}
            onChange={(e) => updateField('subAbility', e.target.value)}
            className="h-8 text-sm"
            readOnly={isReadOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('editor.fieldProfession')}</Label>
          <Input
            value={draft.profession}
            onChange={(e) => updateField('profession', e.target.value)}
            className="h-8 text-sm"
            readOnly={isReadOnly}
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
                readOnly={isReadOnly}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
