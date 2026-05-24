'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/stores/useEditorStore'
import type { EditorDraftCharacter } from '@/stores/useEditorStore'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'

const ENTRY_LIST_STYLE = 'border border-border/30 rounded-md p-3 space-y-2'

export function EditorTalentsTab({
  draft,
}: {
  draft: EditorDraftCharacter
}) {
  const t = useTranslations()
  const updateDraft = useEditorStore((s) => s.updateDraft)

  // ---- Talents ----
  const addTalent = useCallback(() => {
    updateDraft(draft.id, (d) => {
      d.talents.push({ name: '', description: '', icon: '' })
    })
  }, [draft.id, updateDraft])

  const removeTalent = useCallback(
    (index: number) => {
      updateDraft(draft.id, (d) => { d.talents.splice(index, 1) })
    },
    [draft.id, updateDraft]
  )

  const updateTalent = useCallback(
    (index: number, field: 'name' | 'description', value: string) => {
      updateDraft(draft.id, (d) => {
        const entry = d.talents[index]
        if (!entry) return
        entry[field] = value
      })
    },
    [draft.id, updateDraft]
  )

  // ---- Base Skills ----
  const addBaseSkill = useCallback(() => {
    updateDraft(draft.id, (d) => {
      d.baseSkills.push({ name: '', description: '', icon: '' })
    })
  }, [draft.id, updateDraft])

  const removeBaseSkill = useCallback(
    (index: number) => {
      updateDraft(draft.id, (d) => { d.baseSkills.splice(index, 1) })
    },
    [draft.id, updateDraft]
  )

  const updateBaseSkill = useCallback(
    (index: number, field: 'name' | 'description', value: string) => {
      updateDraft(draft.id, (d) => {
        const entry = d.baseSkills[index]
        if (!entry) return
        entry[field] = value
      })
    },
    [draft.id, updateDraft]
  )

  // ---- Potentials ----
  const addPotential = useCallback(() => {
    updateDraft(draft.id, (d) => {
      d.potentials.push({ name: '', description: '' })
    })
  }, [draft.id, updateDraft])

  const removePotential = useCallback(
    (index: number) => {
      updateDraft(draft.id, (d) => { d.potentials.splice(index, 1) })
    },
    [draft.id, updateDraft]
  )

  const movePotential = useCallback(
    (index: number, offset: number) => {
      updateDraft(draft.id, (d) => {
        const target = index + offset
        if (target < 0 || target >= d.potentials.length) return
        const item = d.potentials[index]
        d.potentials.splice(index, 1)
        d.potentials.splice(target, 0, item)
      })
    },
    [draft.id, updateDraft]
  )

  const updatePotential = useCallback(
    (index: number, field: 'name' | 'description', value: string) => {
      updateDraft(draft.id, (d) => {
        const entry = d.potentials[index]
        if (!entry) return
        entry[field] = value
      })
    },
    [draft.id, updateDraft]
  )

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Talents */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold tracking-tight">{t('charGuide.talents')}</h3>
          <Button variant="outline" size="sm" onClick={addTalent}>
            <Plus className="w-3 h-3 mr-1" />
            {t('editor.addTalent')}
          </Button>
        </div>
        <div className={ENTRY_LIST_STYLE}>
          {draft.talents.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('editor.noTalents')}</p>
          )}
          {draft.talents.map((talent, ti) => (
            <div key={ti} className="space-y-1.5 pb-2 border-b border-border/20 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <Input
                  value={talent.name}
                  onChange={(e) => updateTalent(ti, 'name', e.target.value)}
                  placeholder={t('editor.placeholderTalentName')}
                  className="h-7 text-sm flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTalent(ti)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Input
                value={talent.description}
                onChange={(e) => updateTalent(ti, 'description', e.target.value)}
                placeholder={t('editor.placeholderTalentDesc')}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Base Skills */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold tracking-tight">{t('charGuide.baseSkills')}</h3>
          <Button variant="outline" size="sm" onClick={addBaseSkill}>
            <Plus className="w-3 h-3 mr-1" />
            {t('editor.addBaseSkill')}
          </Button>
        </div>
        <div className={ENTRY_LIST_STYLE}>
          {draft.baseSkills.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('editor.noBaseSkills')}</p>
          )}
          {draft.baseSkills.map((bs, bi) => (
            <div key={bi} className="space-y-1.5 pb-2 border-b border-border/20 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <Input
                  value={bs.name}
                  onChange={(e) => updateBaseSkill(bi, 'name', e.target.value)}
                  placeholder={t('editor.placeholderBaseSkillName')}
                  className="h-7 text-sm flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBaseSkill(bi)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Input
                value={bs.description}
                onChange={(e) => updateBaseSkill(bi, 'description', e.target.value)}
                placeholder={t('editor.placeholderBaseSkillDesc')}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Potentials */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold tracking-tight">{t('charGuide.potentials')}</h3>
          <Button variant="outline" size="sm" onClick={addPotential}>
            <Plus className="w-3 h-3 mr-1" />
            {t('editor.addPotential')}
          </Button>
        </div>
        <div className={ENTRY_LIST_STYLE}>
          {draft.potentials.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('editor.noPotentials')}</p>
          )}
          {draft.potentials.map((pot, pi) => (
            <div key={pi} className="space-y-1.5 pb-2 border-b border-border/20 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground font-geist-mono w-6">
                  {pi + 1}
                </span>
                <Input
                  value={pot.name}
                  onChange={(e) => updatePotential(pi, 'name', e.target.value)}
                  placeholder={t('editor.placeholderPotentialName')}
                  className="h-7 text-sm flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => movePotential(pi, -1)}
                  disabled={pi === 0}
                  className="h-7 w-6 p-0"
                >
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => movePotential(pi, 1)}
                  disabled={pi === draft.potentials.length - 1}
                  className="h-7 w-6 p-0"
                >
                  <ChevronDown className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePotential(pi)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Input
                value={pot.description}
                onChange={(e) => updatePotential(pi, 'description', e.target.value)}
                placeholder={t('editor.placeholderPotentialDesc')}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
