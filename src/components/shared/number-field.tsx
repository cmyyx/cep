'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface NumberFieldProps {
  value: number
  minimum: number
  maximum: number
  ariaLabel: string
  onValueChange: (value: number) => void
  className?: string
  disabled?: boolean
}

export function NumberField({ value, minimum, maximum, ariaLabel, onValueChange, className, disabled }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const commitDraft = () => {
    const numeric = Number(draft)
    if (draft !== null && draft !== '' && Number.isFinite(numeric)) {
      onValueChange(Math.min(maximum, Math.max(minimum, numeric)))
    }
    setDraft(null)
  }

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={minimum}
      max={maximum}
      value={draft ?? String(value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn('font-mono tabular-nums', className)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commitDraft}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        commitDraft()
      }}
    />
  )
}
