'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import type { Weapon } from '@/types/matrix'
import { WeaponFormDialog } from './weapon-form-dialog'

type CustomWeaponDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CustomWeaponDialog({
  open,
  onOpenChange,
}: CustomWeaponDialogProps) {
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
        key={editTarget?.id ?? 'add'}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={handleSave}
        initial={editTarget}
      />
    </>
  )
}
