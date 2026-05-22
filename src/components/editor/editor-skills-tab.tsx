'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/stores/useEditorStore'
import type { EditorDraftCharacter } from '@/stores/useEditorStore'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'

const SKILL_LABELS = ['Lv1', 'Lv2', 'Lv3', 'Lv4', 'Lv5', 'Lv6', 'Lv7', 'Lv8', 'Lv9', 'M1', 'M2', 'M3']

export function EditorSkillsTab({
  draft,
}: {
  draft: EditorDraftCharacter
}) {
  const t = useTranslations()
  const updateDraft = useEditorStore((s) => s.updateDraft)
  const [expandedSkills, setExpandedSkills] = useState<Record<number, boolean>>({})

  const addSkill = useCallback(() => {
    updateDraft(draft.id, (d) => {
      d.skills.push({ name: '', description: '', icon: '', type: '', dataTables: [] })
    })
  }, [draft.id, updateDraft])

  const removeSkill = useCallback(
    (index: number) => {
      updateDraft(draft.id, (d) => { d.skills.splice(index, 1) })
    },
    [draft.id, updateDraft]
  )

  const toggleSkill = useCallback(
    (index: number) => { setExpandedSkills((prev) => ({ ...prev, [index]: !prev[index] })) },
    []
  )

  const updateSkillField = useCallback(
    (skillIndex: number, field: string, value: string) => {
      updateDraft(draft.id, (d) => {
        const skill = d.skills[skillIndex]
        if (!skill) return
        ;(skill as unknown as Record<string, unknown>)[field] = value
      })
    },
    [draft.id, updateDraft]
  )

  // ---- Data table operations ----

  const addTable = useCallback(
    (skillIndex: number) => {
      updateDraft(draft.id, (d) => {
        const skill = d.skills[skillIndex]
        if (!skill) return
        skill.dataTables.push({ title: '', rows: [] })
      })
    },
    [draft.id, updateDraft]
  )

  const removeTable = useCallback(
    (skillIndex: number, tableIndex: number) => {
      updateDraft(draft.id, (d) => {
        d.skills[skillIndex]?.dataTables?.splice(tableIndex, 1)
      })
    },
    [draft.id, updateDraft]
  )

  const updateTableTitle = useCallback(
    (skillIndex: number, tableIndex: number, value: string) => {
      updateDraft(draft.id, (d) => {
        const table = d.skills[skillIndex]?.dataTables?.[tableIndex]
        if (!table) return
        table.title = value
      })
    },
    [draft.id, updateDraft]
  )

  const addRow = useCallback(
    (skillIndex: number, tableIndex: number) => {
      updateDraft(draft.id, (d) => {
        const table = d.skills[skillIndex]?.dataTables?.[tableIndex]
        if (!table) return
        table.rows.push({ name: '', values: new Array(12).fill('') })
      })
    },
    [draft.id, updateDraft]
  )

  const removeRow = useCallback(
    (skillIndex: number, tableIndex: number, rowIndex: number) => {
      updateDraft(draft.id, (d) => {
        d.skills[skillIndex]?.dataTables?.[tableIndex]?.rows?.splice(rowIndex, 1)
      })
    },
    [draft.id, updateDraft]
  )

  const updateRowName = useCallback(
    (skillIndex: number, tableIndex: number, rowIndex: number, value: string) => {
      updateDraft(draft.id, (d) => {
        const row = d.skills[skillIndex]?.dataTables?.[tableIndex]?.rows?.[rowIndex]
        if (!row) return
        row.name = value
      })
    },
    [draft.id, updateDraft]
  )

  const updateRowValue = useCallback(
    (skillIndex: number, tableIndex: number, rowIndex: number, levelIndex: number, value: string) => {
      updateDraft(draft.id, (d) => {
        const row = d.skills[skillIndex]?.dataTables?.[tableIndex]?.rows?.[rowIndex]
        if (!row) return
        if (!Array.isArray(row.values)) row.values = new Array(12).fill('')
        while (row.values.length < 12) row.values.push('')
        row.values[levelIndex] = value
      })
    },
    [draft.id, updateDraft]
  )

  return (
    <div className="space-y-4 max-w-[960px]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">{t('editor.tabSkills')}</h3>
        <Button variant="outline" size="sm" onClick={addSkill}>
          <Plus className="w-3 h-3 mr-1" />
          {t('editor.addSkill')}
        </Button>
      </div>

      {draft.skills.length === 0 && (
        <p className="text-sm text-muted-foreground">No skills yet.</p>
      )}

      {draft.skills.map((skill, si) => (
        <div key={si} className="border border-border/30 rounded-md p-3 space-y-2">
          {/* Skill header */}
          <div className="flex items-start gap-2">
            <button
              onClick={(e) => { e.preventDefault(); toggleSkill(si) }}
              className="text-muted-foreground hover:text-foreground mt-1.5 shrink-0"
            >
              {expandedSkills[si] ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-geist-mono">#{si + 1}</span>
                <Input
                  value={skill.name}
                  onChange={(e) => updateSkillField(si, 'name', e.target.value)}
                  placeholder={t('editor.skillName')}
                  className="h-7 text-sm flex-1"
                />
                <Input
                  value={skill.type}
                  onChange={(e) => updateSkillField(si, 'type', e.target.value)}
                  placeholder={t('editor.skillType')}
                  className="h-7 text-sm w-24"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.preventDefault(); removeSkill(si) }}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              {/* Description as textarea */}
              <textarea
                value={skill.description}
                onChange={(e) => updateSkillField(si, 'description', e.target.value)}
                placeholder={t('editor.skillDesc')}
                rows={3}
                className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs
                  placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
              />
            </div>
          </div>

          {/* Collapsed data tables */}
          {expandedSkills[si] && (
            <div className="space-y-3 pl-8 pt-2">
              {skill.dataTables.map((table, ti) => (
                <div key={ti} className="border border-border/20 rounded-sm p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={table.title}
                      onChange={(e) => updateTableTitle(si, ti, e.target.value)}
                      placeholder={t('editor.placeholderDataTableTitle')}
                      className="h-7 text-xs w-40"
                    />
                    <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); addRow(si, ti) }} className="h-6 text-[11px] px-2">
                      <Plus className="w-3 h-3 mr-1" />
                      {t('editor.addSkillRow')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); removeTable(si, ti) }} className="h-6 text-[11px] px-2 text-muted-foreground hover:text-destructive ml-auto">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {table.rows.length > 0 && (
                    <div className="overflow-x-auto">
                      <div className="min-w-[1050px]">
                        {/* Column headers */}
                        <div className="flex items-center gap-0.5 mb-1 text-[10px] text-muted-foreground">
                          <div className="w-28 shrink-0" />
                          {SKILL_LABELS.map((label) => (
                            <div key={label} className="w-[72px] shrink-0 text-right font-geist-mono pr-1">
                              {label}
                            </div>
                          ))}
                          <div className="w-6 shrink-0" />
                        </div>

                        {/* Rows */}
                        {table.rows.map((row, ri) => (
                          <div key={ri} className="flex items-center gap-0.5 mb-0.5">
                            <Input
                              value={row.name}
                              onChange={(e) => updateRowName(si, ti, ri, e.target.value)}
                              placeholder={t('editor.placeholderParamName')}
                              className="h-7 text-xs w-28 shrink-0"
                            />
                            {SKILL_LABELS.map((_, li) => (
                              <Input
                                key={li}
                                value={(Array.isArray(row.values) ? row.values[li] : '') || ''}
                                onChange={(e) => updateRowValue(si, ti, ri, li, e.target.value)}
                                className="h-7 text-xs w-[72px] shrink-0 font-geist-mono"
                                placeholder="-"
                              />
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.preventDefault(); removeRow(si, ti, ri) }}
                              className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {table.rows.length === 0 && (
                    <p className="text-[11px] text-muted-foreground pl-2">
                      No rows. Click &quot;{t('editor.addSkillRow')}&quot; to start.
                    </p>
                  )}
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); addTable(si) }} className="h-7 text-xs">
                <Plus className="w-3 h-3 mr-1" />
                {t('editor.addSkillTable')}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
