'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

// ─── Ownership pill badge ──────────────────────────────────────────────────

export function OwnershipBadge({
  active,
  onToggle,
  label,
  activeColor,
}: {
  active: boolean
  onToggle: () => void
  label: string
  activeColor: 'emerald' | 'sky'
}) {
  const activeBg = activeColor === 'emerald' ? 'bg-emerald-600' : 'bg-sky-600'
  const activeBorder = activeColor === 'emerald' ? 'border-emerald-600' : 'border-sky-600'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-medium border transition-colors',
        active
          ? `${activeBg} ${activeBorder} text-white`
          : 'border-border text-muted-foreground hover:border-foreground/30',
      )}
    >
      {active && <span className="text-[7px]">✓</span>}
      <span>{label}</span>
    </button>
  )
}

// ─── Editable note ─────────────────────────────────────────────────────────

export function EditableNote({
  note,
  onSave,
}: {
  note: string
  onSave: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note)

  const handleSave = useCallback(() => {
    onSave(draft)
    setEditing(false)
  }, [draft, onSave])

  const handleCancel = useCallback(() => {
    setDraft(note)
    setEditing(false)
  }, [note])

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') handleCancel()
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full text-[9px] px-1 py-px rounded border border-border bg-background outline-none focus:border-ring"
        autoFocus
      />
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
        setDraft(note)
      }}
      className={cn(
        'text-[9px] text-center truncate leading-tight hover:text-foreground transition-colors cursor-text w-full',
        note ? 'text-muted-foreground' : 'text-muted-foreground/40 border border-dashed border-muted-foreground/20 rounded px-1',
      )}
      title={note || undefined}
    >
      {note || '点击添加备注'}
    </button>
  )
}
