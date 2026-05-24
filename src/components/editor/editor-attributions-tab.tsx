'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/stores/useEditorStore'
import type { EditorDraftCharacter } from '@/stores/useEditorStore'
import { Plus, Trash2 } from 'lucide-react'

export function EditorAttributionsTab({
  draft,
}: {
  draft: EditorDraftCharacter
}) {
  const t = useTranslations()
  const updateDraft = useEditorStore((s) => s.updateDraft)

  const addAttribution = useCallback(() => {
    updateDraft(draft.id, (d) => {
      d.guide.attributions.push({ role: '', name: '', url: '', note: '' })
    })
  }, [draft.id, updateDraft])

  const removeAttribution = useCallback(
    (index: number) => {
      updateDraft(draft.id, (d) => {
        d.guide.attributions.splice(index, 1)
      })
    },
    [draft.id, updateDraft]
  )

  const updateAttr = useCallback(
    (index: number, field: string, value: string) => {
      updateDraft(draft.id, (d) => {
        const attr = d.guide.attributions[index]
        if (!attr) return
        ;(attr as unknown as Record<string, unknown>)[field] = value
      })
    },
    [draft.id, updateDraft]
  )

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">{t('editor.guideAttributions')}</h3>
        <Button variant="outline" size="sm" onClick={addAttribution}>
          <Plus className="w-3 h-3 mr-1" />
          {t('editor.addAttribution')}
        </Button>
      </div>

      {draft.guide.attributions.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No attributions.</p>
      )}

      {draft.guide.attributions.map((attr, ai) => (
        <div key={ai} className="border border-border/30 rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">#{ai + 1}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeAttribution(ai)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Role</label>
              <Input
                value={attr.role}
                onChange={(e) => updateAttr(ai, 'role', e.target.value)}
                placeholder={t('editor.placeholderAttributionRole')}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Name</label>
              <Input
                value={attr.name}
                onChange={(e) => updateAttr(ai, 'name', e.target.value)}
                placeholder={t('editor.placeholderAttributionName')}
                className="h-7 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">URL</label>
            <Input
              value={attr.url}
              onChange={(e) => updateAttr(ai, 'url', e.target.value)}
              placeholder="https://..."
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Note</label>
            <Input
              value={attr.note}
              onChange={(e) => updateAttr(ai, 'note', e.target.value)}
              placeholder={t('editor.placeholderAttributionNote')}
              className="h-7 text-xs"
            />
          </div>
        </div>
      ))}
    </div>
  )
}
