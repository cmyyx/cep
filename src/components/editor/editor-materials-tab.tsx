'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/stores/useEditorStore'
import type { EditorDraftCharacter } from '@/stores/useEditorStore'
import { isMaterialNameValid } from '@/lib/validate-editor-names'
import { cn } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'

const ELITE_LEVELS = ['elite1', 'elite2', 'elite3', 'elite4'] as const

export function EditorMaterialsTab({
  draft,
  isReadOnly,
}: {
  draft: EditorDraftCharacter
  isReadOnly?: boolean
}) {
  const t = useTranslations()
  const updateDraft = useEditorStore((s) => s.updateDraft)

  // Track invalid material entries: key = `${level}-${index}`
  const [invalidMaterials, setInvalidMaterials] = useState<Set<string>>(new Set())

  const addMaterial = useCallback(
    (level: (typeof ELITE_LEVELS)[number]) => {
      updateDraft(draft.id, (d) => {
        if (!d.materials[level]) d.materials[level] = []
        d.materials[level].push('')
      })
    },
    [draft.id, updateDraft]
  )

  const removeMaterial = useCallback(
    (level: (typeof ELITE_LEVELS)[number], index: number) => {
      updateDraft(draft.id, (d) => {
        if (!d.materials[level]) return
        d.materials[level].splice(index, 1)
      })
      // Clear validation state for the affected level — splice shifts indices, invalidating old keys
      setInvalidMaterials((prev) => {
        const next = new Set(prev)
        const prefix = `${level}-`
        for (const k of next) {
          if (k.startsWith(prefix)) next.delete(k)
        }
        return next
      })
    },
    [draft.id, updateDraft]
  )

  const updateMaterial = useCallback(
    (level: (typeof ELITE_LEVELS)[number], index: number, value: string) => {
      updateDraft(draft.id, (d) => {
        if (!d.materials[level]) d.materials[level] = []
        d.materials[level][index] = value
      })
    },
    [draft.id, updateDraft]
  )

  return (
    <div className="space-y-4 max-w-lg">
      <h3 className="text-sm font-semibold tracking-tight">{t('editor.tabMaterials')}</h3>

      {ELITE_LEVELS.map((level) => (
        <div key={level} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">{t(`charGuide.${level}`)}</Label>
            <Button variant="outline" size="sm" onClick={() => addMaterial(level)} className="h-6 text-[11px] px-2" disabled={isReadOnly}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-1">
            {(!draft.materials[level] || draft.materials[level].length === 0) && (
              <p className="text-xs text-muted-foreground/50 italic">No materials.</p>
            )}
            {(draft.materials[level] || []).map((item, ii) => {
              const matKey = `${level}-${ii}`
              const isInvalid = invalidMaterials.has(matKey)
              return (
              <div key={ii} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                <Input
                  value={item}
                  onChange={(e) => {
                    updateMaterial(level, ii, e.target.value)
                    // Clear error on edit
                    if (isInvalid) {
                      setInvalidMaterials((prev) => {
                        const next = new Set(prev)
                        next.delete(matKey)
                        return next
                      })
                    }
                  }}
                  onBlur={() => {
                    if (!isMaterialNameValid(item)) {
                      setInvalidMaterials((prev) => new Set(prev).add(matKey))
                    } else {
                      setInvalidMaterials((prev) => {
                        const next = new Set(prev)
                        next.delete(matKey)
                        return next
                      })
                    }
                  }}
                  placeholder={t('editor.placeholderMaterial')}
                  className={cn('h-7 text-xs', isInvalid && 'border-ship-red ring-1 ring-ship-red/30')}
                  readOnly={isReadOnly}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMaterial(level, ii)}
                  className="h-7 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  disabled={isReadOnly}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
                </div>
                {isInvalid && (
                  <p className="text-[10px] text-ship-red leading-tight ml-1">
                    {t('editor.materialNotFound')}
                  </p>
                )}
              </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
