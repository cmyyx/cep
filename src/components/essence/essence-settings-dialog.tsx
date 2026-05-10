'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Settings } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import type { SettingKey } from '@/types/essence-settings'

// ─── Paired setting rows (one label, two switches) ─────────────────────────

interface PairedRow {
  labelI18n: string
  listKey: SettingKey
  plansKey: SettingKey
  /** Sub-row shown when either switch is ON */
  subSetting?: {
    subKey: SettingKey
    labelI18n: string
  }
}

const PAIRED_ROWS: PairedRow[] = [
  {
    labelI18n: 'essenceSettings.hideEssenceOwned',
    listKey: 'hideEssenceOwnedWeaponsList',
    plansKey: 'hideEssenceOwnedWeaponsPlans',
    subSetting: {
      subKey: 'onlyHideWhenBothOwned',
      labelI18n: 'essenceSettings.onlyHideWhenBothOwned',
    },
  },
  {
    labelI18n: 'essenceSettings.hideUnowned',
    listKey: 'hideUnownedWeaponsList',
    plansKey: 'hideUnownedWeaponsPlans',
  },
  {
    labelI18n: 'essenceSettings.hideFourStar',
    listKey: 'hideFourStarWeaponsList',
    plansKey: 'hideFourStarWeaponsPlans',
  },
  {
    labelI18n: 'essenceSettings.enableOwnershipEdit',
    listKey: 'enableOwnershipEditList',
    plansKey: 'enableOwnershipEditPlans',
  },
  {
    labelI18n: 'essenceSettings.enableNotes',
    listKey: 'enableNotesList',
    plansKey: 'enableNotesPlans',
  },
]

// ─── Dialog ────────────────────────────────────────────────────────────────

export function EssenceSettingsDialog() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

  const toggleFlag = useEssenceSettingsStore((s) => s.toggleFlag)

  // Read all flags individually (avoids new-object-per-render infinite loop)
  const flags = {
    hideEssenceOwnedWeaponsList: useEssenceSettingsStore((s) => s.hideEssenceOwnedWeaponsList),
    hideUnownedWeaponsList: useEssenceSettingsStore((s) => s.hideUnownedWeaponsList),
    hideFourStarWeaponsList: useEssenceSettingsStore((s) => s.hideFourStarWeaponsList),
    enableOwnershipEditList: useEssenceSettingsStore((s) => s.enableOwnershipEditList),
    enableNotesList: useEssenceSettingsStore((s) => s.enableNotesList),
    hideEssenceOwnedWeaponsPlans: useEssenceSettingsStore((s) => s.hideEssenceOwnedWeaponsPlans),
    hideUnownedWeaponsPlans: useEssenceSettingsStore((s) => s.hideUnownedWeaponsPlans),
    hideFourStarWeaponsPlans: useEssenceSettingsStore((s) => s.hideFourStarWeaponsPlans),
    enableOwnershipEditPlans: useEssenceSettingsStore((s) => s.enableOwnershipEditPlans),
    enableNotesPlans: useEssenceSettingsStore((s) => s.enableNotesPlans),
    onlyHideWhenBothOwned: useEssenceSettingsStore((s) => s.onlyHideWhenBothOwned),
  }

  // Stable flag map for dynamic lookup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const flagMap = useMemo(() => flags, [
    flags.hideEssenceOwnedWeaponsList,
    flags.hideUnownedWeaponsList,
    flags.hideFourStarWeaponsList,
    flags.enableOwnershipEditList,
    flags.enableNotesList,
    flags.hideEssenceOwnedWeaponsPlans,
    flags.hideUnownedWeaponsPlans,
    flags.hideFourStarWeaponsPlans,
    flags.enableOwnershipEditPlans,
    flags.enableNotesPlans,
    flags.onlyHideWhenBothOwned,
  ])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={t('essence.settings')}
      >
        <Settings className="size-4" />
      </Button>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('essenceSettings.title')}</DialogTitle>
        </DialogHeader>

        {/* Table layout */}
        <div className="max-h-[60vh] overflow-y-auto -mx-4 px-4">
          <table className="w-full text-sm">
            {/* Column headers */}
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground">
                <th className="text-left font-normal pb-2 w-full">
                  {t('essenceSettings.settingItem')}
                </th>
                <th className="text-center font-normal pb-2 px-2 whitespace-nowrap">
                  {t('essenceSettings.weaponList')}
                </th>
                <th className="text-center font-normal pb-2 pl-2 whitespace-nowrap">
                  {t('essenceSettings.planRec')}
                </th>
              </tr>
            </thead>
            <tbody>
              {PAIRED_ROWS.flatMap((row) => {
                const listOn = flagMap[row.listKey]
                const plansOn = flagMap[row.plansKey]
                const subActive = !!(row.subSetting && (listOn || plansOn))

                const rows = [
                  <tr key={row.listKey}>
                    <td className="py-2 pr-3">
                      <span className="text-foreground leading-tight">
                        {t(row.labelI18n)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center w-14">
                      <Switch
                        size="sm"
                        checked={listOn}
                        onCheckedChange={() => toggleFlag(row.listKey)}
                      />
                    </td>
                    <td className="py-2 pl-2 text-center w-14">
                      <Switch
                        size="sm"
                        checked={plansOn}
                        onCheckedChange={() => toggleFlag(row.plansKey)}
                      />
                    </td>
                  </tr>,
                ]

                // Sub-setting row (indented, appears when either parent is ON)
                if (subActive && row.subSetting) {
                  rows.push(
                    <tr key={row.subSetting.subKey}>
                      <td className="py-1.5 pr-3 pl-6">
                        <span className="text-[11px] text-muted-foreground leading-tight">
                          {t(row.subSetting.labelI18n)}
                        </span>
                      </td>
                      <td colSpan={2} className="py-1.5 text-center">
                        <Switch
                          size="sm"
                          checked={flagMap[row.subSetting.subKey]}
                          onCheckedChange={() =>
                            toggleFlag(row.subSetting!.subKey)
                          }
                        />
                      </td>
                    </tr>,
                  )
                }

                return rows
              })}
            </tbody>
          </table>
        </div>

      </DialogContent>
    </Dialog>
  )
}
