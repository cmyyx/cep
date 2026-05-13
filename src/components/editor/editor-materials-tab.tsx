/* eslint-disable react-hooks/immutability */
'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/stores/useEditorStore'
import type { EditorDraftCharacter } from '@/stores/useEditorStore'
import { Plus, Trash2 } from 'lucide-react'

const ELITE_LEVELS = ['elite1', 'elite2', 'elite3', 'elite4'] as const

export function EditorMaterialsTab({
  draft,
}: {
  draft: EditorDraftCharacter
}) {
  const t = useTranslations()
  const markDirty = useEditorStore((s) => s.markDirty)

  const dirty = useCallback(() => markDirty(draft.id), [draft.id, markDirty])

  const addMaterial = useCallback(
    (level: (typeof ELITE_LEVELS)[number]) => {
      if (!draft.materials[level]) draft.materials[level] = []
      draft.materials[level].push('')
      dirty()
    },
    [draft, dirty]
  )

  const removeMaterial = useCallback(
    (level: (typeof ELITE_LEVELS)[number], index: number) => {
      if (!draft.materials[level]) return
      draft.materials[level].splice(index, 1)
      dirty()
    },
    [draft, dirty]
  )

  const updateMaterial = useCallback(
    (level: (typeof ELITE_LEVELS)[number], index: number, value: string) => {
      if (!draft.materials[level]) draft.materials[level] = []
      draft.materials[level][index] = value
      dirty()
    },
    [draft, dirty]
  )

  return (
    <div className="space-y-4 max-w-lg">
      <h3 className="text-sm font-semibold tracking-tight">{t('editor.tabMaterials')}</h3>

      {ELITE_LEVELS.map((level) => (
        <div key={level} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">{t(`charGuide.${level}`)}</Label>
            <Button variant="outline" size="sm" onClick={() => addMaterial(level)} className="h-6 text-[11px] px-2">
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-1">
            {(!draft.materials[level] || draft.materials[level].length === 0) && (
              <p className="text-xs text-muted-foreground/50 italic">No materials.</p>
            )}
            {(draft.materials[level] || []).map((item, ii) => (
              <div key={ii} className="flex items-center gap-1">
                <Input
                  value={item}
                  onChange={(e) => updateMaterial(level, ii, e.target.value)}
                  placeholder={t('editor.placeholderMaterial')}
                  className="h-7 text-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMaterial(level, ii)}
                  className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
