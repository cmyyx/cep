/* eslint-disable react-hooks/immutability */
'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useEditorStore, type GuideSubTab } from '@/stores/useEditorStore'
import { cn } from '@/lib/utils'
import type { EditorDraftCharacter } from '@/stores/useEditorStore'
import { Plus, Trash2 } from 'lucide-react'

const GUIDE_SUB_TABS: { key: GuideSubTab; labelKey: string }[] = [
  { key: 'equip', labelKey: 'editor.guideEquipRows' },
  { key: 'analysis', labelKey: 'editor.guideAnalysis' },
  { key: 'team', labelKey: 'editor.guideTeamSlots' },
]

export type EditorGuideTabProps = {
  draft: EditorDraftCharacter
}

export function EditorGuideTab({ draft }: EditorGuideTabProps) {
  const t = useTranslations()
  const markDirty = useEditorStore((s) => s.markDirty)
  const guideSubTab = useEditorStore((s) => s.guideSubTab)
  const setGuideSubTab = useEditorStore((s) => s.setGuideSubTab)

  const dirty = useCallback(() => markDirty(draft.id), [draft.id, markDirty])

  const guide = draft.guide

  // ===== Equip Rows =====
  const addEquipRow = useCallback(() => {
    guide.equipRows.push({
      weapons: [],
      equipment: [null, null, null, null],
    })
    dirty()
  }, [guide, dirty])

  const removeEquipRow = useCallback(
    (index: number) => {
      guide.equipRows.splice(index, 1)
      dirty()
    },
    [guide, dirty]
  )

  const addWeapon = useCallback(
    (rowIndex: number) => {
      const row = guide.equipRows[rowIndex]
      if (!row) return
      row.weapons.push({ name: '', icon: '', note: '', rarity: null })
      dirty()
    },
    [guide, dirty]
  )

  const removeWeapon = useCallback(
    (rowIndex: number, weaponIndex: number) => {
      const row = guide.equipRows[rowIndex]
      if (!row?.weapons) return
      row.weapons.splice(weaponIndex, 1)
      dirty()
    },
    [guide, dirty]
  )

  const updateWeapon = useCallback(
    (rowIndex: number, weaponIndex: number, field: string, value: string | number | null) => {
      const row = guide.equipRows[rowIndex]
      if (!row?.weapons) return
      const w = row.weapons[weaponIndex]
      if (!w) return
      ;(w as unknown as Record<string, unknown>)[field] = field === 'rarity' ? (value === '' ? null : Number(value)) : value
      dirty()
    },
    [guide, dirty]
  )

  const updateEquip = useCallback(
    (rowIndex: number, slotIndex: number, field: string, value: string | number | null) => {
      const row = guide.equipRows[rowIndex]
      if (!row) return
      let entry = row.equipment[slotIndex]
      if (!entry) {
        entry = { name: '', icon: '', note: '', rarity: null }
        row.equipment[slotIndex] = entry
      }
      ;(entry as unknown as Record<string, unknown>)[field] = field === 'rarity' ? (value === '' ? null : Number(value)) : value
      dirty()
    },
    [guide, dirty]
  )

  const clearEquip = useCallback(
    (rowIndex: number, slotIndex: number) => {
      const row = guide.equipRows[rowIndex]
      if (!row) return
      row.equipment[slotIndex] = null
      dirty()
    },
    [guide, dirty]
  )

  // ===== Team Slots =====
  const addTeamSlot = useCallback(() => {
    guide.teamSlots.push({ name: '', note: '', options: [] })
    dirty()
  }, [guide, dirty])

  const removeTeamSlot = useCallback(
    (index: number) => {
      guide.teamSlots.splice(index, 1)
      dirty()
    },
    [guide, dirty]
  )

  const addTeamOption = useCallback(
    (slotIndex: number) => {
      const slot = guide.teamSlots[slotIndex]
      if (!slot) return
      slot.options.push({ name: '', tag: '', weapons: [], equipment: [] })
      dirty()
    },
    [guide, dirty]
  )

  const removeTeamOption = useCallback(
    (slotIndex: number, optionIndex: number) => {
      const slot = guide.teamSlots[slotIndex]
      if (!slot?.options) return
      slot.options.splice(optionIndex, 1)
      dirty()
    },
    [guide, dirty]
  )

  const updateTeamOptionField = useCallback(
    (slotIndex: number, optionIndex: number, field: string, value: string) => {
      const slot = guide.teamSlots[slotIndex]
      if (!slot?.options) return
      const option = slot.options[optionIndex]
      if (!option) return
      ;(option as unknown as Record<string, unknown>)[field] = value
      dirty()
    },
    [guide, dirty]
  )

  const addTeamOptWeapon = useCallback(
    (slotIndex: number, optionIndex: number) => {
      const slot = guide.teamSlots[slotIndex]
      if (!slot?.options) return
      const option = slot.options[optionIndex]
      if (!option) return
      option.weapons.push({ name: '', icon: '', note: '', rarity: null })
      dirty()
    },
    [guide, dirty]
  )

  const removeTeamOptWeapon = useCallback(
    (slotIndex: number, optionIndex: number, weaponIndex: number) => {
      const slot = guide.teamSlots[slotIndex]
      if (!slot?.options) return
      const option = slot.options[optionIndex]
      if (!option?.weapons) return
      option.weapons.splice(weaponIndex, 1)
      dirty()
    },
    [guide, dirty]
  )

  const addTeamOptEquip = useCallback(
    (slotIndex: number, optionIndex: number) => {
      const slot = guide.teamSlots[slotIndex]
      if (!slot?.options) return
      const option = slot.options[optionIndex]
      if (!option) return
      option.equipment.push({ name: '', icon: '', note: '', rarity: null })
      dirty()
    },
    [guide, dirty]
  )

  const removeTeamOptEquip = useCallback(
    (slotIndex: number, optionIndex: number, equipIndex: number) => {
      const slot = guide.teamSlots[slotIndex]
      if (!slot?.options) return
      const option = slot.options[optionIndex]
      if (!option?.equipment) return
      option.equipment.splice(equipIndex, 1)
      dirty()
    },
    [guide, dirty]
  )

  // ===== Analysis & Tips =====
  const updateGuideField = useCallback(
    (field: string, value: string) => {
      ;(guide as unknown as Record<string, unknown>)[field] = value
      dirty()
    },
    [guide, dirty]
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
            <Button variant="outline" size="sm" onClick={addEquipRow}>
              <Plus className="w-3 h-3 mr-1" />
              {t('editor.addEquipRow')}
            </Button>
          </div>

          {guide.equipRows.length === 0 && (
            <p className="text-xs text-muted-foreground italic">{t('editor.guideNoEquipRows')}</p>
          )}

          {guide.equipRows.map((row, ri) => (
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
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </Button>
                </div>
                {row.weapons.map((w, wi) => (
                  <div key={wi} className="flex items-center gap-1 mb-1">
                    <Input
                      value={w.name}
                      onChange={(e) => updateWeapon(ri, wi, 'name', e.target.value)}
                      placeholder={t('editor.placeholderGuideName')}
                      className="h-7 text-xs flex-1"
                    />
                    <Input
                      value={w.note}
                      onChange={(e) => updateWeapon(ri, wi, 'note', e.target.value)}
                      placeholder={t('editor.placeholderGuideNote')}
                      className="h-7 text-xs w-20"
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
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeWeapon(ri, wi)}
                      className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive"
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
                              onChange={(e) => updateEquip(ri, ei, 'name', e.target.value)}
                              placeholder="Name"
                              className="h-7 text-xs flex-1"
                            />
                            <Input
                              value={eq.note}
                              onChange={(e) => updateEquip(ri, ei, 'note', e.target.value)}
                              placeholder={t('editor.placeholderGuideNote')}
                              className="h-7 text-xs w-16"
                            />
                            <Input
                              type="number"
                              min={1}
                              max={6}
                              value={eq.rarity ?? ''}
                              onChange={(e) => updateEquip(ri, ei, 'rarity', e.target.value)}
                              placeholder={t('editor.placeholderGuideRarity')}
                              className="h-7 text-xs w-12"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => clearEquip(ri, ei)}
                              className="h-7 w-6 p-0 text-[10px] text-muted-foreground hover:text-destructive"
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
              value={guide.analysis}
              onChange={(e) => updateGuideField('analysis', e.target.value)}
              className="min-h-[120px] resize-y"
              placeholder={t('editor.placeholderAnalysis')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('editor.guideTeamTips')}</Label>
            <Textarea
              value={guide.teamTips}
              onChange={(e) => updateGuideField('teamTips', e.target.value)}
              className="min-h-[80px] resize-y"
              placeholder={t('editor.placeholderTeamTips')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('editor.guideOperationTips')}</Label>
            <Textarea
              value={guide.operationTips}
              onChange={(e) => updateGuideField('operationTips', e.target.value)}
              className="min-h-[80px] resize-y"
              placeholder={t('editor.placeholderOperationTips')}
            />
          </div>
        </div>
      )}

      {/* Team Slots */}
      {guideSubTab === 'team' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t('editor.guideTeamSlots')}</span>
            <Button variant="outline" size="sm" onClick={addTeamSlot}>
              <Plus className="w-3 h-3 mr-1" />
              {t('editor.addTeamSlot')}
            </Button>
          </div>

          {guide.teamSlots.length === 0 && (
            <p className="text-xs text-muted-foreground italic">{t('editor.guideNoTeamSlots')}</p>
          )}

          {guide.teamSlots.map((slot, si) => (
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
                    />
                    <Input
                      value={opt.tag}
                      onChange={(e) => updateTeamOptionField(si, oi, 'tag', e.target.value)}
                      placeholder={t('editor.placeholderTag')}
                      className="h-7 text-xs w-24"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTeamOption(si, oi)}
                      className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive"
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
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                    {opt.weapons.map((w, wi) => (
                      <div key={wi} className="flex items-center gap-1 mb-0.5">
                        <Input
                          value={w.name}
                          onChange={(e) => {
                            w.name = e.target.value
                            dirty()
                          }}
                          placeholder={t('editor.placeholderGuideName')}
                          className="h-7 text-xs flex-1"
                        />
                        <Input
                          value={w.note}
                          onChange={(e) => {
                            w.note = e.target.value
                            dirty()
                          }}
                          placeholder={t('editor.placeholderGuideNote')}
                          className="h-7 text-xs w-20"
                        />
                        <Input
                          type="number"
                          min={1}
                          max={6}
                          value={w.rarity ?? ''}
                          onChange={(e) => {
                            w.rarity = e.target.value === '' ? null : Number(e.target.value)
                            dirty()
                          }}
                          placeholder={t('editor.placeholderGuideRarity')}
                          className="h-7 text-xs w-12"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTeamOptWeapon(si, oi, wi)}
                          className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive"
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
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                    {opt.equipment.map((eq, ei) => (
                      <div key={ei} className="flex items-center gap-1 mb-0.5">
                        <Input
                          value={eq.name}
                          onChange={(e) => {
                            eq.name = e.target.value
                            dirty()
                          }}
                          placeholder={t('editor.placeholderGuideName')}
                          className="h-7 text-xs flex-1"
                        />
                        <Input
                          type="number"
                          min={1}
                          max={6}
                          value={eq.rarity ?? ''}
                          onChange={(e) => {
                            eq.rarity = e.target.value === '' ? null : Number(e.target.value)
                            dirty()
                          }}
                          placeholder={t('editor.placeholderGuideRarity')}
                          className="h-7 text-xs w-12"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTeamOptEquip(si, oi, ei)}
                          className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive"
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
