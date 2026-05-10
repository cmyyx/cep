'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, Upload } from 'lucide-react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { weapons as staticWeapons } from '@/data/weapons'
import type { Weapon } from '@/types/matrix'
import { cn } from '@/lib/utils'

// ─── Helper: get unique values from static weapons ──────────────────────────

const STATS = [...new Set(staticWeapons.map((w) => w.primaryStat))].sort()
const ELEMENTS = [...new Set(staticWeapons.map((w) => w.elementalDamage))].sort()
const ABILITIES = [...new Set(staticWeapons.map((w) => w.specialAbility))].sort()
const TYPES = [...new Set(staticWeapons.map((w) => w.type))].sort()
const RARITIES = [4, 5, 6] as const

// ─── Form field ────────────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-ring"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

// ─── Weapon form dialog ────────────────────────────────────────────────────

function WeaponFormDialog({
  open,
  onOpenChange,
  onSave,
  initial,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (weapon: Weapon) => void
  initial?: Weapon
}) {
  const t = useTranslations()
  const [name, setName] = useState(initial?.name ?? '')
  const [rarity, setRarity] = useState<4 | 5 | 6>(initial?.rarity ?? 5)
  const [type, setType] = useState(initial?.type ?? TYPES[0])
  const [primaryStat, setPrimaryStat] = useState(initial?.primaryStat ?? STATS[0])
  const [elementalDamage, setElemental] = useState(initial?.elementalDamage ?? ELEMENTS[0])
  const [specialAbility, setAbility] = useState(initial?.specialAbility ?? ABILITIES[0])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageData, setImageData] = useState<string | undefined>(initial?.imageId?.startsWith('data:') ? initial.imageId : undefined)
  const [fileName, setFileName] = useState<string | undefined>(
    initial?.imageId?.startsWith('data:') ? undefined : undefined
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setImageData(reader.result as string)
    reader.readAsDataURL(file)
  }

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
      imageId: imageData ?? initial?.imageId,
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
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">{t('essence.weaponImage')}</span>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-3 mr-1" />
                {imageData ? t('essence.reselectImage') : t('essence.selectImage')}
              </Button>
              {fileName && (
                <span className="text-[10px] text-muted-foreground truncate max-w-24">{fileName}</span>
              )}
              {imageData && (
                <div className="size-8 rounded border border-border overflow-hidden flex-shrink-0 bg-[url(/images/item-frame-bg.png)] bg-cover bg-center">
                  <Image src={imageData} alt="" width={32} height={32} className="object-cover" unoptimized />
                </div>
              )}
            </div>
          </label>
          <div className="flex gap-2">
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-[10px] text-muted-foreground">{t('essence.rarity')}</span>
              <div className="flex gap-1">
                {RARITIES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRarity(r)}
                    className={cn(
                      'flex-1 h-8 rounded-md border text-xs font-medium transition-colors',
                      rarity === r
                        ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                        : 'border-border text-muted-foreground hover:border-foreground/30',
                    )}
                  >
                    {r}★
                  </button>
                ))}
              </div>
            </label>
          </div>
          <SelectField label={t('essence.weaponType')} value={type} options={TYPES} onChange={setType} />
          <SelectField label={t('essence.attrPrimary')} value={primaryStat} options={STATS} onChange={setPrimaryStat} />
          <SelectField label={t('essence.attrElemental')} value={elementalDamage} options={ELEMENTS} onChange={setElemental} />
          <SelectField label={t('essence.attrSpecial')} value={specialAbility} options={ABILITIES} onChange={setAbility} />
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

// ─── Main dialog: custom weapon list ───────────────────────────────────────

export function CustomWeaponDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations()
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Weapon | undefined>(undefined)

  const customWeapons = useEssenceSettingsStore((s) => s.customWeapons)
  const addCustomWeapon = useEssenceSettingsStore((s) => s.addCustomWeapon)
  const updateCustomWeapon = useEssenceSettingsStore((s) => s.updateCustomWeapon)
  const removeCustomWeapon = useEssenceSettingsStore((s) => s.removeCustomWeapon)

  const handleAdd = () => {
    setEditTarget(undefined)
    setFormOpen(true)
  }

  const handleEdit = (w: Weapon) => {
    setEditTarget(w)
    setFormOpen(true)
  }

  const handleSave = (weapon: Weapon) => {
    if (editTarget) {
      updateCustomWeapon(editTarget.id, weapon)
    } else {
      addCustomWeapon(weapon)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('essence.customWeapons')}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[40vh] overflow-y-auto -mx-2 px-2">
            {customWeapons.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {t('essence.noCustomWeapons')}
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {customWeapons.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
                  >
                    <span className="flex-1 text-xs truncate font-medium">
                      {w.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {w.rarity}★ {w.type}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleEdit(w)}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeCustomWeapon(w.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={handleAdd}>
              <Plus className="size-3 mr-1" />
              {t('essence.addCustomWeapon')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WeaponFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={handleSave}
        initial={editTarget}
      />
    </>
  )
}
