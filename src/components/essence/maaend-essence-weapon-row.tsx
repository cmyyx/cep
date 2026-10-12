'use client'

import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { cn } from '@/lib/utils'
import type { Weapon } from '@/types/matrix'

interface MaaEndEssenceWeaponRowProps {
  weapon?: Weapon
  name: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export function MaaEndEssenceWeaponRow({ weapon, name, checked, onCheckedChange }: MaaEndEssenceWeaponRowProps) {
  const checkboxId = useId()
  const hasArtwork = weapon && !weapon.id.startsWith('custom-') && !weapon.id.startsWith('preview:')
  return (
    <div className="flex items-center gap-2">
      {checked !== undefined && <Checkbox id={checkboxId} checked={checked} disabled={!onCheckedChange} onCheckedChange={onCheckedChange} aria-label={name} />}
      <Label htmlFor={checked === undefined ? undefined : checkboxId} className={cn('flex min-w-0 flex-1 items-center gap-2', 'font-normal leading-normal')}>
        <RarityFrame
          imageSrc={hasArtwork ? `/images/weapon/${weapon.iconId ?? weapon.id}.avif` : undefined}
          title={name}
          rarity={weapon?.rarity}
          showTitle={false}
          imageAlt=""
          className="size-10 shrink-0 rounded-md"
        />
        <span className="min-w-0 break-words">{name}</span>
      </Label>
    </div>
  )
}

export default MaaEndEssenceWeaponRow
