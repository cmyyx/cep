'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEditorStore } from '@/stores/useEditorStore'
import type { EditorDraftCharacter } from '@/stores/useEditorStore'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'

const SKILL_LABELS = ['Lv1', 'Lv2', 'Lv3', 'Lv4', 'Lv5', 'Lv6', 'Lv7', 'Lv8', 'Lv9', 'M1', 'M2', 'M3']

const SKILL_TYPE_OPTIONS = ['普通攻击', '战技', '连携技', '终结技'] as const

const RELATION_OPTIONS: { value: '>' | '>=' | '='; label: string }[] = [
  { value: '>', label: '> 优先' },
  { value: '>=', label: '≥ 大于等于' },
  { value: '=', label: '= 同级' },
]

export function EditorSkillsTab({
  draft,
  isReadOnly,
}: {
  draft: EditorDraftCharacter
  isReadOnly?: boolean
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
    (skillIndex: number, field: 'name' | 'type' | 'description', value: string) => {
      updateDraft(draft.id, (d) => {
        const skill = d.skills[skillIndex]
        if (!skill) return
        skill[field] = value
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

  // ---- Skill upgrade priority ----

  const addSkillPriority = useCallback(() => {
    updateDraft(draft.id, (d) => {
      d.guide.skillPriorities ??= []
      if (d.guide.skillPriorities.length >= 4) return
      d.guide.skillPriorities.push({ skillName: '', note: '' })
    })
  }, [draft.id, updateDraft])

  const removeSkillPriority = useCallback(
    (index: number) => {
      updateDraft(draft.id, (d) => {
        d.guide.skillPriorities ??= []
        d.guide.skillPriorities.splice(index, 1)
      })
    },
    [draft.id, updateDraft]
  )

  const updateSkillPriority = useCallback(
    (index: number, field: 'skillName' | 'note', value: string) => {
      updateDraft(draft.id, (d) => {
        d.guide.skillPriorities ??= []
        const sp = d.guide.skillPriorities[index]
        if (!sp) return
        sp[field] = value
      })
    },
    [draft.id, updateDraft]
  )

  const setSkillPriorityRelation = useCallback(
    (index: number, relation: '>' | '>=' | '=' | undefined) => {
      updateDraft(draft.id, (d) => {
        d.guide.skillPriorities ??= []
        const sp = d.guide.skillPriorities[index]
        if (!sp) return
        sp.relation = relation
      })
    },
    [draft.id, updateDraft]
  )

  return (
    <div className="space-y-4 max-w-[960px]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">{t('editor.tabSkills')}</h3>
        <Button variant="outline" size="sm" onClick={addSkill} disabled={isReadOnly}>
          <Plus className="w-3 h-3 mr-1" />
          {t('editor.addSkill')}
        </Button>
      </div>

      {/* Skill upgrade priority */}
      <div className="[box-shadow:var(--shadow-border)] rounded-md p-3 space-y-2 bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground/80">技能升级优先级</span>
          <Button
            variant="outline"
            size="sm"
            onClick={addSkillPriority}
            disabled={isReadOnly || (draft.guide.skillPriorities ?? []).length >= 4}
            className="h-6 text-[11px] px-2"
          >
            <Plus className="w-2.5 h-2.5 mr-1" />
            添加技能
          </Button>
        </div>

        {(draft.guide.skillPriorities ?? []).length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">暂无技能优先级，添加后可指定升级顺序。</p>
        )}

        {(draft.guide.skillPriorities ?? []).map((sp, i) => {
          const priorities = draft.guide.skillPriorities ?? []
          const isLast = i === priorities.length - 1
          const usedNames = new Set(
            priorities
              .filter((_, idx) => idx !== i)
              .map((s) => s.skillName)
              .filter(Boolean)
          )
          return (
            <div key={i} className="flex items-center gap-1">
              <span className="font-geist-mono text-[10px] text-muted-foreground w-5 shrink-0 text-right">
                #{i + 1}
              </span>
              <Select
                value={sp.skillName}
                onValueChange={(v) => { if (v) updateSkillPriority(i, 'skillName', v) }}
                disabled={isReadOnly}
              >
                <SelectTrigger size="sm" className="h-7 text-xs flex-1">
                  <SelectValue>{(v: string | null) => v || '选择技能类型'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SKILL_TYPE_OPTIONS.map((name) => (
                    <SelectItem
                      key={name}
                      value={name}
                      disabled={usedNames.has(name)}
                    >
                      {name}{usedNames.has(name) ? '（已选）' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={sp.note}
                onChange={(e) => updateSkillPriority(i, 'note', e.target.value)}
                placeholder="备注"
                className="h-7 text-xs w-28"
                readOnly={isReadOnly}
              />
              {!isLast && (
                <Select
                  value={sp.relation ?? ''}
                  onValueChange={(v) =>
                    setSkillPriorityRelation(i, (v || undefined) as '>' | '>=' | '=' | undefined)
                  }
                  disabled={isReadOnly}
                >
                  <SelectTrigger size="sm" className="h-7 text-xs w-[6.5rem]">
                    <SelectValue>{(v: string | null) => v || '关系到下一项'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {RELATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSkillPriority(i)}
                className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                disabled={isReadOnly}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )
        })}
      </div>

      {draft.skills.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('editor.noSkills')}</p>
      )}

      {draft.skills.map((skill, si) => (
        <div key={si} className="border border-border/30 rounded-md p-3 space-y-2">
          {/* Skill header */}
          <div className="flex items-start gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.preventDefault(); toggleSkill(si) }}
              className="p-0 h-auto text-muted-foreground hover:text-foreground mt-1.5 shrink-0"
            >
              {expandedSkills[si] ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </Button>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-geist-mono">#{si + 1}</span>
                <Input
                  value={skill.name}
                  onChange={(e) => updateSkillField(si, 'name', e.target.value)}
                  placeholder={t('editor.skillName')}
                  className="h-7 text-sm flex-1"
                  readOnly={isReadOnly}
                />
                <Input
                  value={skill.type}
                  onChange={(e) => updateSkillField(si, 'type', e.target.value)}
                  placeholder={t('editor.skillType')}
                  className="h-7 text-sm w-24"
                  readOnly={isReadOnly}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.preventDefault(); removeSkill(si) }}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  disabled={isReadOnly}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Textarea
                value={skill.description}
                onChange={(e) => updateSkillField(si, 'description', e.target.value)}
                placeholder={t('editor.skillDesc')}
                rows={3}
                className="text-xs resize-y"
                readOnly={isReadOnly}
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
                      readOnly={isReadOnly}
                    />
                    <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); addRow(si, ti) }} className="h-6 text-[11px] px-2" disabled={isReadOnly}>
                      <Plus className="w-3 h-3 mr-1" />
                      {t('editor.addSkillRow')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); removeTable(si, ti) }} className="h-6 text-[11px] px-2 text-muted-foreground hover:text-destructive ml-auto" disabled={isReadOnly}>
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
                              readOnly={isReadOnly}
                            />
                            {SKILL_LABELS.map((_, li) => (
                              <Input
                                key={li}
                                value={(Array.isArray(row.values) ? row.values[li] : '') || ''}
                                onChange={(e) => updateRowValue(si, ti, ri, li, e.target.value)}
                                className="h-7 text-xs w-[72px] shrink-0 font-geist-mono"
                                placeholder="-"
                                readOnly={isReadOnly}
                              />
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.preventDefault(); removeRow(si, ti, ri) }}
                              className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                              disabled={isReadOnly}
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
                      {t('editor.noRowsMessage', { addSkillRow: t('editor.addSkillRow') })}
                    </p>
                  )}
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); addTable(si) }} className="h-7 text-xs" disabled={isReadOnly}>
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
