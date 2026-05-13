'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ─── Ownership pill badge ──────────────────────────────────────────────────

export function OwnershipBadge({
  active,
  onToggle,
  label,
  activeColor,
  compact,
}: {
  active: boolean
  onToggle: () => void
  label: string
  activeColor: 'emerald' | 'sky'
  compact?: boolean
}) {
  const activeBg = activeColor === 'emerald' ? 'bg-emerald-600' : 'bg-sky-600'
  const activeBorder = activeColor === 'emerald' ? 'border-emerald-600' : 'border-sky-600'

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        title={label}
        className={cn(
          'rounded-full border transition-colors',
          active
            ? `${activeBg} ${activeBorder} text-white`
            : 'border-border bg-muted/50 hover:border-foreground/30',
        )}
      >
        {active && <span className="text-[7px] leading-none">✓</span>}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'rounded-full px-1.5 py-px text-[9px] font-medium border transition-colors',
        active
          ? `${activeBg} ${activeBorder} text-white`
          : 'border-border text-muted-foreground hover:border-foreground/30',
      )}
    >
      {active && <span className="text-[7px]">✓</span>}
      <span>{label}</span>
    </Button>
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
  const t = useTranslations('essence')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note)

  if (editing) {
    return (
      <Input
        value={draft}
        onChange={(e) => {
          const value = e.target.value
          setDraft(value)
          onSave(value)
        }}
        onBlur={() => {
          onSave(draft)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onSave(draft); setEditing(false); }
          if (e.key === 'Escape') setEditing(false)
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full text-[9px] px-1 py-px h-5 text-center"
        autoFocus
      />
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
        setDraft(note)
      }}
      className={cn(
        'text-[9px] text-center truncate leading-tight hover:text-foreground transition-colors cursor-text w-full h-auto min-h-0',
        note ? 'text-muted-foreground' : 'text-muted-foreground/40 border border-dashed border-muted-foreground/20 rounded px-1',
      )}
      title={note || undefined}
    >
      {note || t('notePlaceholder')}
    </Button>
  )
}
