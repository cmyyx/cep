'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Upload } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { weapons as staticWeapons } from '@/data/weapons'
import type { Weapon } from '@/types/matrix'
import { cn } from '@/lib/utils'

const STATS = [...new Set(staticWeapons.map((w) => w.primaryStat))].sort()
const ELEMENTS = [...new Set(staticWeapons.map((w) => w.elementalDamage))].sort()
const ABILITIES = [...new Set(staticWeapons.map((w) => w.specialAbility))].sort()
const TYPES = [...new Set(staticWeapons.map((w) => w.type))].sort()
const RARITIES = [4, 5, 6] as const

export type WeaponFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (weapon: Weapon) => void
  initial?: Weapon
}

export function WeaponFormDialog({
  open,
  onOpenChange,
  onSave,
  initial,
}: WeaponFormDialogProps) {
  const t = useTranslations()
  const [name, setName] = useState(initial?.name ?? '')
  const [rarity, setRarity] = useState<4 | 5 | 6>(initial?.rarity ?? 5)
  const [type, setType] = useState(initial?.type ?? TYPES[0])
  const [primaryStat, setPrimaryStat] = useState(initial?.primaryStat ?? STATS[0])
  const [elementalDamage, setElemental] = useState(initial?.elementalDamage ?? ELEMENTS[0])
  const [specialAbility, setAbility] = useState(initial?.specialAbility ?? ABILITIES[0])

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? `custom-${Date.now()}`,
      name: name.trim(),
      rarity,
      type,
      primaryStat,
      elementalDamage,
      specialAbility,
      chars: initial?.chars ?? [],
      imageId: initial?.imageId,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {initial ? t('essence.editCustomWeapon') : t('essence.addCustomWeapon')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">{t('essence.weaponName')}</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('essence.weaponNamePlaceholder')}
              className="h-8 text-xs"
            />
          </label>
          {/* TODO: Re-enable image upload when Canvas compression + IndexedDB storage is implemented.
              Currently base64 is stored in Zustand persist → localStorage (5MB limit, large payload). */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">{t('essence.weaponImage')}</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled
              >
                <Upload className="size-3 mr-1" />
                {t('essence.selectImage')}
              </Button>
              <span className="text-[10px] text-muted-foreground">{t('essence.weaponImageNotReady')}</span>
            </div>
          </label>
          <div className="flex gap-2">
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-[10px] text-muted-foreground">{t('essence.rarity')}</span>
              <div className="flex gap-1">
                {RARITIES.map((r) => (
                  <Button
                    key={r}
                    variant="ghost"
                    size="sm"
                    onClick={() => setRarity(r)}
                    className={cn(
                      'flex-1 h-8 rounded-md border text-xs font-medium transition-colors',
                      rarity === r
                        ? 'border-amber-400 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
                        : 'border-border text-muted-foreground hover:border-foreground/30',
                    )}
                  >
                    {r}★
                  </Button>
                ))}
              </div>
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">{t('essence.weaponType')}</span>
            <Select value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue>{(v: string) => v ?? ''}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">{t('essence.attrPrimary')}</span>
            <Select value={primaryStat} onValueChange={(v) => v && setPrimaryStat(v)}>
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue>{(v: string) => v ?? ''}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">{t('essence.attrElemental')}</span>
            <Select value={elementalDamage} onValueChange={(v) => v && setElemental(v)}>
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue>{(v: string) => v ?? ''}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ELEMENTS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">{t('essence.attrSpecial')}</span>
            <Select value={specialAbility} onValueChange={(v) => v && setAbility(v)}>
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue>{(v: string) => v ?? ''}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ABILITIES.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
            {t('essence.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
