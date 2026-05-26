'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useEditorStore, type GuideSubTab } from '@/stores/useEditorStore'
import { cn } from '@/lib/utils'
import type { EditorDraftCharacter } from '@/stores/useEditorStore'
import { isWeaponNameValid, isEquipNameValid } from '@/lib/validate-editor-names'
import { Plus, Trash2 } from 'lucide-react'

const GUIDE_SUB_TABS: { key: GuideSubTab; labelKey: string }[] = [
  { key: 'equip', labelKey: 'editor.guideEquipRows' },
  { key: 'analysis', labelKey: 'editor.guideAnalysis' },
  { key: 'team', labelKey: 'editor.guideTeamSlots' },
]

export type EditorGuideTabProps = {
  draft: EditorDraftCharacter
  isReadOnly?: boolean
}

export function EditorGuideTab({ draft, isReadOnly }: EditorGuideTabProps) {
  const t = useTranslations()
  const updateDraft = useEditorStore((s) => s.updateDraft)
  const guideSubTab = useEditorStore((s) => s.guideSubTab)
  const setGuideSubTab = useEditorStore((s) => s.setGuideSubTab)

  // ===== Equip Rows =====
  const addEquipRow = useCallback(() => {
    updateDraft(draft.id, (d) => {
      d.guide.equipRows.push({
        weapons: [],
        equipment: [null, null, null, null],
      })
    })
  }, [draft.id, updateDraft])

  const removeEquipRow = useCallback(
    (index: number) => {
      updateDraft(draft.id, (d) => { d.guide.equipRows.splice(index, 1) })
    },
    [draft.id, updateDraft]
  )

  const addWeapon = useCallback(
    (rowIndex: number) => {
      updateDraft(draft.id, (d) => {
        const row = d.guide.equipRows[rowIndex]
        if (!row) return
        row.weapons.push({ name: '', icon: '', note: '', rarity: null })
      })
    },
    [draft.id, updateDraft]
  )

  const removeWeapon = useCallback(
    (rowIndex: number, weaponIndex: number) => {
      updateDraft(draft.id, (d) => {
        d.guide.equipRows[rowIndex]?.weapons?.splice(weaponIndex, 1)
      })
    },
    [draft.id, updateDraft]
  )

  const updateWeapon = useCallback(
    (rowIndex: number, weaponIndex: number, field: string, value: string | number | null) => {
      updateDraft(draft.id, (d) => {
        const w = d.guide.equipRows[rowIndex]?.weapons?.[weaponIndex]
        if (!w) return
        ;(w as unknown as Record<string, unknown>)[field] = field === 'rarity' ? (value === '' ? null : Number(value)) : value
      })
    },
    [draft.id, updateDraft]
  )

  const updateEquip = useCallback(
    (rowIndex: number, slotIndex: number, field: string, value: string | number | null) => {
      updateDraft(draft.id, (d) => {
        const row = d.guide.equipRows[rowIndex]
        if (!row) return
        let entry = row.equipment[slotIndex]
        if (!entry) {
          entry = { name: '', icon: '', note: '', rarity: null }
          row.equipment[slotIndex] = entry
        }
        ;(entry as unknown as Record<string, unknown>)[field] = field === 'rarity' ? (value === '' ? null : Number(value)) : value
      })
    },
    [draft.id, updateDraft]
  )

  const clearEquip = useCallback(
    (rowIndex: number, slotIndex: number) => {
      updateDraft(draft.id, (d) => {
        const row = d.guide.equipRows[rowIndex]
        if (!row) return
        row.equipment[slotIndex] = null
      })
    },
    [draft.id, updateDraft]
  )

  // Validation state: keys are "wpn-{ri}-{wi}" or "equip-{ri}-{ei}" or "teamwpn-{si}-{oi}-{wi}" or "teamequip-{si}-{oi}-{ei}"
  const [invalidNames, setInvalidNames] = useState<Set<string>>(new Set())

  const validateNameField = useCallback(
    (key: string, name: string, category: 'weapon' | 'equip') => {
      const isValid = category === 'weapon' ? isWeaponNameValid(name) : isEquipNameValid(name)
      setInvalidNames((prev) => {
        const next = new Set(prev)
        if (isValid) next.delete(key)
        else next.add(key)
        return next
      })
    },
    [],
  )

  // ===== Team Slots =====
  const addTeamSlot = useCallback(() => {
    updateDraft(draft.id, (d) => {
      d.guide.teamSlots.push({ name: '', note: '', options: [] })
    })
  }, [draft.id, updateDraft])

  const removeTeamSlot = useCallback(
    (index: number) => {
      updateDraft(draft.id, (d) => { d.guide.teamSlots.splice(index, 1) })
    },
    [draft.id, updateDraft]
  )

  const addTeamOption = useCallback(
    (slotIndex: number) => {
      updateDraft(draft.id, (d) => {
        const slot = d.guide.teamSlots[slotIndex]
        if (!slot) return
        slot.options.push({ name: '', tag: '', weapons: [], equipment: [] })
      })
    },
    [draft.id, updateDraft]
  )

  const removeTeamOption = useCallback(
    (slotIndex: number, optionIndex: number) => {
      updateDraft(draft.id, (d) => {
        d.guide.teamSlots[slotIndex]?.options?.splice(optionIndex, 1)
      })
    },
    [draft.id, updateDraft]
  )

  const updateTeamOptionField = useCallback(
    (slotIndex: number, optionIndex: number, field: string, value: string) => {
      updateDraft(draft.id, (d) => {
        const option = d.guide.teamSlots[slotIndex]?.options?.[optionIndex]
        if (!option) return
        ;(option as unknown as Record<string, unknown>)[field] = value
      })
    },
    [draft.id, updateDraft]
  )

  const addTeamOptWeapon = useCallback(
    (slotIndex: number, optionIndex: number) => {
      updateDraft(draft.id, (d) => {
        const option = d.guide.teamSlots[slotIndex]?.options?.[optionIndex]
        if (!option) return
        option.weapons.push({ name: '', icon: '', note: '', rarity: null })
      })
    },
    [draft.id, updateDraft]
  )

  const removeTeamOptWeapon = useCallback(
    (slotIndex: number, optionIndex: number, weaponIndex: number) => {
      updateDraft(draft.id, (d) => {
        d.guide.teamSlots[slotIndex]?.options?.[optionIndex]?.weapons?.splice(weaponIndex, 1)
      })
    },
    [draft.id, updateDraft]
  )

  const addTeamOptEquip = useCallback(
    (slotIndex: number, optionIndex: number) => {
      updateDraft(draft.id, (d) => {
        const option = d.guide.teamSlots[slotIndex]?.options?.[optionIndex]
        if (!option) return
        option.equipment.push({ name: '', icon: '', note: '', rarity: null })
      })
    },
    [draft.id, updateDraft]
  )

  const removeTeamOptEquip = useCallback(
    (slotIndex: number, optionIndex: number, equipIndex: number) => {
      updateDraft(draft.id, (d) => {
        d.guide.teamSlots[slotIndex]?.options?.[optionIndex]?.equipment?.splice(equipIndex, 1)
      })
    },
    [draft.id, updateDraft]
  )

  // ===== Analysis & Tips =====
  const updateGuideField = useCallback(
    (field: string, value: string) => {
      updateDraft(draft.id, (d) => {
        ;(d.guide as unknown as Record<string, unknown>)[field] = value
      })
    },
    [draft.id, updateDraft]
  )

  return (
    <div className="space-y-4 max-w-3xl">
      <h3 className="text-sm font-semibold tracking-tight">{t('editor.tabGuide')}</h3>

      {/* Sub tabs */}
      <div className="flex border-b border-border/30">
        {GUIDE_SUB_TABS.map((sub) => (
          <Button
            key={sub.key}
            variant="ghost"
            onClick={() => setGuideSubTab(sub.key)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-[1px] rounded-none h-auto',
              guideSubTab === sub.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t(sub.labelKey)}
          </Button>
        ))}
      </div>

      {/* Equip Rows */}
      {guideSubTab === 'equip' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t('editor.guideEquipRows')}</span>
            <Button variant="outline" size="sm" onClick={addEquipRow} disabled={isReadOnly}>
              <Plus className="w-3 h-3 mr-1" />
              {t('editor.addEquipRow')}
            </Button>
          </div>

          {draft.guide.equipRows.length === 0 && (
            <p className="text-xs text-muted-foreground italic">{t('editor.guideNoEquipRows')}</p>
          )}

          {draft.guide.equipRows.map((row, ri) => (
            <div
              key={ri}
              className="border border-border/30 rounded-md p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('editor.guideRowLabel', { number: ri + 1 })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEquipRow(ri)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  disabled={isReadOnly}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              {/* Weapons */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[11px] text-muted-foreground">{t('editor.guideWeapons')}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addWeapon(ri)}
                    className="h-5 text-[10px] px-1"
                    disabled={isReadOnly}
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </Button>
                </div>
                {row.weapons.map((w, wi) => (
                  <div key={wi} className="flex items-center gap-1 mb-1">
                    <Input
                      value={w.name}
                      onChange={(e) => {
                        updateWeapon(ri, wi, 'name', e.target.value)
                        const key = `wpn-${ri}-${wi}`
                        if (invalidNames.has(key)) {
                          setInvalidNames((prev) => { const n = new Set(prev); n.delete(key); return n })
                        }
                      }}
                      onBlur={() => validateNameField(`wpn-${ri}-${wi}`, w.name, 'weapon')}
                      placeholder={t('editor.placeholderGuideName')}
                      className={cn('h-7 text-xs flex-1', invalidNames.has(`wpn-${ri}-${wi}`) && 'border-ship-red ring-1 ring-ship-red/30')}
                      readOnly={isReadOnly}
                    />
                    <Input
                      value={w.note}
                      onChange={(e) => updateWeapon(ri, wi, 'note', e.target.value)}
                      placeholder={t('editor.placeholderGuideNote')}
                      className="h-7 text-xs w-20"
                      readOnly={isReadOnly}
                    />
                    <Input
                      type="number"
                      min={1}
                      max={6}
                      value={w.rarity ?? ''}
                      onChange={(e) => updateWeapon(ri, wi, 'rarity', e.target.value)}
                      placeholder={t('editor.placeholderGuideRarity')}
                      className={cn(
                        'h-7 text-xs w-16',
                        (w.rarity ?? 0) >= 6 && 'text-rarity-6-star',
                        (w.rarity ?? 0) >= 5 && (w.rarity ?? 0) < 6 && 'text-rarity-5-star'
                      )}
                      readOnly={isReadOnly}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeWeapon(ri, wi)}
                      className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive"
                      disabled={isReadOnly}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Equipment slots */}
              <div>
                <span className="text-[11px] text-muted-foreground mb-1 block">Equipment</span>
                <div className="grid grid-cols-2 gap-1">
                  {[0, 1, 2, 3].map((ei) => {
                    const eq = row.equipment[ei]
                    return (
                      <div key={ei} className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground w-8">
                          {[t('equip.slot.armor'), t('equip.slot.gloves'), t('equip.slot.accessory'), t('equip.slot.accessory2')][ei]}
                        </span>
                        {eq ? (
                          <>
                            <Input
                              value={eq.name}
                              onChange={(e) => {
                                updateEquip(ri, ei, 'name', e.target.value)
                                const key = `equip-${ri}-${ei}`
                                if (invalidNames.has(key)) {
                                  setInvalidNames((prev) => { const n = new Set(prev); n.delete(key); return n })
                                }
                              }}
                              onBlur={() => validateNameField(`equip-${ri}-${ei}`, eq.name, 'equip')}
                              placeholder="Name"
                              className={cn('h-7 text-xs flex-1', invalidNames.has(`equip-${ri}-${ei}`) && 'border-ship-red ring-1 ring-ship-red/30')}
                              readOnly={isReadOnly}
                            />
                            <Input
                              value={eq.note}
                              onChange={(e) => updateEquip(ri, ei, 'note', e.target.value)}
                              placeholder={t('editor.placeholderGuideNote')}
                              className="h-7 text-xs w-16"
                              readOnly={isReadOnly}
                            />
                            <Input
                              type="number"
                              min={1}
                              max={6}
                              value={eq.rarity ?? ''}
                              onChange={(e) => updateEquip(ri, ei, 'rarity', e.target.value)}
                              placeholder={t('editor.placeholderGuideRarity')}
                              className="h-7 text-xs w-12"
                              readOnly={isReadOnly}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => clearEquip(ri, ei)}
                              className="h-7 w-6 p-0 text-[10px] text-muted-foreground hover:text-destructive"
                              disabled={isReadOnly}
                            >
                              x
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateEquip(ri, ei, 'name', '')}
                            className="h-7 text-[10px] text-muted-foreground/50"
                            disabled={isReadOnly}
                          >
                            {t('editor.guideAddEquip')}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analysis & Tips */}
      {guideSubTab === 'analysis' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('editor.guideAnalysis')}</Label>
            <Textarea
              value={draft.guide.analysis}
              onChange={(e) => updateGuideField('analysis', e.target.value)}
              className="min-h-[120px] resize-y"
              placeholder={t('editor.placeholderAnalysis')}
              readOnly={isReadOnly}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('editor.guideTeamTips')}</Label>
            <Textarea
              value={draft.guide.teamTips}
              onChange={(e) => updateGuideField('teamTips', e.target.value)}
              className="min-h-[80px] resize-y"
              placeholder={t('editor.placeholderTeamTips')}
              readOnly={isReadOnly}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('editor.guideOperationTips')}</Label>
            <Textarea
              value={draft.guide.operationTips}
              onChange={(e) => updateGuideField('operationTips', e.target.value)}
              className="min-h-[80px] resize-y"
              placeholder={t('editor.placeholderOperationTips')}
              readOnly={isReadOnly}
            />
          </div>
        </div>
      )}

      {/* Team Slots */}
      {guideSubTab === 'team' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t('editor.guideTeamSlots')}</span>
            <Button variant="outline" size="sm" onClick={addTeamSlot} disabled={isReadOnly}>
              <Plus className="w-3 h-3 mr-1" />
              {t('editor.addTeamSlot')}
            </Button>
          </div>

          {draft.guide.teamSlots.length === 0 && (
            <p className="text-xs text-muted-foreground italic">{t('editor.guideNoTeamSlots')}</p>
          )}

          {draft.guide.teamSlots.map((slot, si) => (
            <div
              key={si}
              className="border border-border/30 rounded-md p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('team.slot', { number: si + 1 })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTeamSlot(si)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  disabled={isReadOnly}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              {/* Options */}
              {slot.options.map((opt, oi) => (
                <div
                  key={oi}
                  className="border border-border/20 rounded-sm p-2 ml-3 space-y-2"
                >
                  <div className="flex items-center gap-1">
                    <Input
                      value={opt.name}
                      onChange={(e) => updateTeamOptionField(si, oi, 'name', e.target.value)}
                      placeholder={t('editor.placeholderTeamCharName')}
                      className="h-7 text-sm flex-1"
                      readOnly={isReadOnly}
                    />
                    <Input
                      value={opt.tag}
                      onChange={(e) => updateTeamOptionField(si, oi, 'tag', e.target.value)}
                      placeholder={t('editor.placeholderTag')}
                      className="h-7 text-xs w-24"
                      readOnly={isReadOnly}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTeamOption(si, oi)}
                      className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive"
                      disabled={isReadOnly}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Option weapons */}
                  <div className="ml-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[10px] text-muted-foreground">{t('editor.guideWeapons')}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addTeamOptWeapon(si, oi)}
                        className="h-5 text-[10px] px-1"
                        disabled={isReadOnly}
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                    {opt.weapons.map((w, wi) => (
                      <div key={wi} className="flex items-center gap-1 mb-0.5">
                        <Input
                          value={w.name}
                          onChange={(e) => {
                            updateDraft(draft.id, (d) => {
                              const optW = d.guide.teamSlots[si]?.options?.[oi]?.weapons?.[wi]
                              if (!optW) return
                              optW.name = e.target.value
                            })
                            const key = `teamwpn-${si}-${oi}-${wi}`
                            if (invalidNames.has(key)) {
                              setInvalidNames((prev) => { const n = new Set(prev); n.delete(key); return n })
                            }
                          }}
                          onBlur={() => validateNameField(`teamwpn-${si}-${oi}-${wi}`, w.name, 'weapon')}
                          placeholder={t('editor.placeholderGuideName')}
                          className={cn('h-7 text-xs flex-1', invalidNames.has(`teamwpn-${si}-${oi}-${wi}`) && 'border-ship-red ring-1 ring-ship-red/30')}
                          readOnly={isReadOnly}
                        />
                        <Input
                          value={w.note}
                          onChange={(e) => {
                            updateDraft(draft.id, (d) => {
                              const optW = d.guide.teamSlots[si]?.options?.[oi]?.weapons?.[wi]
                              if (!optW) return
                              optW.note = e.target.value
                            })
                          }}
                          placeholder={t('editor.placeholderGuideNote')}
                          className="h-7 text-xs w-20"
                          readOnly={isReadOnly}
                        />
                        <Input
                          type="number"
                          min={1}
                          max={6}
                          value={w.rarity ?? ''}
                          onChange={(e) => {
                            updateDraft(draft.id, (d) => {
                              const optW = d.guide.teamSlots[si]?.options?.[oi]?.weapons?.[wi]
                              if (!optW) return
                              optW.rarity = e.target.value === '' ? null : Number(e.target.value)
                            })
                          }}
                          placeholder={t('editor.placeholderGuideRarity')}
                          className="h-7 text-xs w-12"
                          readOnly={isReadOnly}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTeamOptWeapon(si, oi, wi)}
                          className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive"
                          disabled={isReadOnly}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Option equipment */}
                  <div className="ml-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[10px] text-muted-foreground">{t('editor.guideEquipment')}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addTeamOptEquip(si, oi)}
                        className="h-5 text-[10px] px-1"
                        disabled={isReadOnly}
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                    {opt.equipment.map((eq, ei) => (
                      <div key={ei} className="flex items-center gap-1 mb-0.5">
                        <Input
                          value={eq.name}
                          onChange={(e) => {
                            updateDraft(draft.id, (d) => {
                              const optE = d.guide.teamSlots[si]?.options?.[oi]?.equipment?.[ei]
                              if (!optE) return
                              optE.name = e.target.value
                            })
                            const key = `teamequip-${si}-${oi}-${ei}`
                            if (invalidNames.has(key)) {
                              setInvalidNames((prev) => { const n = new Set(prev); n.delete(key); return n })
                            }
                          }}
                          onBlur={() => validateNameField(`teamequip-${si}-${oi}-${ei}`, eq.name, 'equip')}
                          placeholder={t('editor.placeholderGuideName')}
                          className={cn('h-7 text-xs flex-1', invalidNames.has(`teamequip-${si}-${oi}-${ei}`) && 'border-ship-red ring-1 ring-ship-red/30')}
                          readOnly={isReadOnly}
                        />
                        <Input
                          type="number"
                          min={1}
                          max={6}
                          value={eq.rarity ?? ''}
                          onChange={(e) => {
                            updateDraft(draft.id, (d) => {
                              const optE = d.guide.teamSlots[si]?.options?.[oi]?.equipment?.[ei]
                              if (!optE) return
                              optE.rarity = e.target.value === '' ? null : Number(e.target.value)
                            })
                          }}
                          placeholder={t('editor.placeholderGuideRarity')}
                          className="h-7 text-xs w-12"
                          readOnly={isReadOnly}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTeamOptEquip(si, oi, ei)}
                          className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive"
                          disabled={isReadOnly}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => addTeamOption(si)}
                className="h-7 text-xs ml-3"
                disabled={isReadOnly}
              >
                <Plus className="w-3 h-3 mr-1" />
                {t('editor.addTeamOption')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
