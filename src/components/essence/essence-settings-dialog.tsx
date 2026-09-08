'use client'

import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FilterGroup } from '@/components/shared/filter-group'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { getRegions } from '@/data/dungeons'
import { dungeons } from '@/data/dungeons'
import { regionI18nKey } from '@/data/region-i18n'
import { weapons } from '@/data/weapons'
import { cn } from '@/lib/utils'
import { acquisitionCategoryIds, acquisitionCategoryLabelText } from '@/lib/weapon-acquisition'
import type { SettingKey } from '@/types/essence-settings'

import { useWikiTranslations } from '@/hooks/use-wiki-translations'
const REGIONS = getRegions(dungeons)

// Hideable acquisition categories derived from real weapon data; unknown
// categories (weapons without sources) are not hideable by design.
const ACQUISITION_CATEGORY_IDS = acquisitionCategoryIds(
  weapons.flatMap((weapon) => weapon.acquisitionSources ?? []),
)

// ─── Paired setting rows (one label, two switches) ─────────────────────────

interface PairedRow {
  labelI18n: string
  listKey: SettingKey
  plansKey: SettingKey
  /** Sub-row shown when either parent is ON. */
  subSetting?: {
    listKey: SettingKey
    plansKey: SettingKey
    labelI18n: string
  }
}

const PAIRED_ROWS: PairedRow[] = [
  {
    labelI18n: 'essenceSettings.hideEssenceOwned',
    listKey: 'hideEssenceOwnedWeaponsList',
    plansKey: 'hideEssenceOwnedWeaponsPlans',
    subSetting: {
      listKey: 'onlyHideWhenBothOwnedList',
      plansKey: 'onlyHideWhenBothOwnedPlans',
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
    labelI18n: 'essenceSettings.hideThreeStar',
    listKey: 'hideThreeStarWeaponsList',
    plansKey: 'hideThreeStarWeaponsPlans',
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
  {
    labelI18n: 'essenceSettings.enableTooltip',
    listKey: 'enableTooltipList',
    plansKey: 'enableTooltipPlans',
  },
  {
    labelI18n: 'essenceSettings.keepUpVisible',
    listKey: 'keepUpVisibleList',
    plansKey: 'keepUpVisiblePlans',
  },
]

// Shared template for the header and every data row — identical column
// tracks are what keep the switches aligned under their header labels
// (per-row auto tracks would size to each row's own content).
const SETTING_GRID_COLS = 'grid min-w-0 grid-cols-[minmax(0,1fr)_5rem_5rem]'

// ─── Dialog ────────────────────────────────────────────────────────────────

export function EssenceSettingsDialog() {
  const t = useTranslations()
  const { text: wikiText } = useWikiTranslations()
  const acquisitionCategoryLabel = (categoryId: string): string =>
    acquisitionCategoryLabelText(categoryId, wikiText, t)
  const [open, setOpen] = useState(false)

  const toggleFlag = useEssenceSettingsStore((s) => s.toggleFlag)
  const regionFirst = useEssenceSettingsStore((s) => s.regionFirst)
  const regionSecond = useEssenceSettingsStore((s) => s.regionSecond)
  const setRegionFirst = useEssenceSettingsStore((s) => s.setRegionFirst)
  const setRegionSecond = useEssenceSettingsStore((s) => s.setRegionSecond)
  const hiddenAcquisitionCategoriesList = useEssenceSettingsStore((s) => s.hiddenAcquisitionCategoriesList)
  const hiddenAcquisitionCategoriesPlans = useEssenceSettingsStore((s) => s.hiddenAcquisitionCategoriesPlans)
  const setHiddenAcquisitionCategories = useEssenceSettingsStore((s) => s.setHiddenAcquisitionCategories)

  // Read all flags individually — each selector triggers re-render only when its value changes
  const flags = {
    hideEssenceOwnedWeaponsList: useEssenceSettingsStore((s) => s.hideEssenceOwnedWeaponsList),
    hideUnownedWeaponsList: useEssenceSettingsStore((s) => s.hideUnownedWeaponsList),
    hideFourStarWeaponsList: useEssenceSettingsStore((s) => s.hideFourStarWeaponsList),
    hideThreeStarWeaponsList: useEssenceSettingsStore((s) => s.hideThreeStarWeaponsList),
    onlyHideWhenBothOwnedList: useEssenceSettingsStore((s) => s.onlyHideWhenBothOwnedList),
    enableOwnershipEditList: useEssenceSettingsStore((s) => s.enableOwnershipEditList),
    enableNotesList: useEssenceSettingsStore((s) => s.enableNotesList),
    enableTooltipList: useEssenceSettingsStore((s) => s.enableTooltipList),
    hideEssenceOwnedWeaponsPlans: useEssenceSettingsStore((s) => s.hideEssenceOwnedWeaponsPlans),
    hideUnownedWeaponsPlans: useEssenceSettingsStore((s) => s.hideUnownedWeaponsPlans),
    hideFourStarWeaponsPlans: useEssenceSettingsStore((s) => s.hideFourStarWeaponsPlans),
    hideThreeStarWeaponsPlans: useEssenceSettingsStore((s) => s.hideThreeStarWeaponsPlans),
    onlyHideWhenBothOwnedPlans: useEssenceSettingsStore((s) => s.onlyHideWhenBothOwnedPlans),
    enableOwnershipEditPlans: useEssenceSettingsStore((s) => s.enableOwnershipEditPlans),
    enableNotesPlans: useEssenceSettingsStore((s) => s.enableNotesPlans),
    enableTooltipPlans: useEssenceSettingsStore((s) => s.enableTooltipPlans),
    keepUpVisibleList: useEssenceSettingsStore((s) => s.keepUpVisibleList),
    keepUpVisiblePlans: useEssenceSettingsStore((s) => s.keepUpVisiblePlans),
  }

  const toggleHiddenCategory = (scope: 'list' | 'plans', current: string[], categoryId: string) => {
    const next = current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId]
    setHiddenAcquisitionCategories(scope, next)
  }

  const acquisitionChips = (scope: 'list' | 'plans', hidden: string[]) =>
    ACQUISITION_CATEGORY_IDS.map((categoryId) => ({
      key: categoryId,
      label: acquisitionCategoryLabel(categoryId),
      valid: true,
      selected: hidden.includes(categoryId),
      onToggle: () => toggleHiddenCategory(scope, hidden, categoryId),
    }))

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

        <div className="max-h-[60vh] overflow-y-auto -mx-4 px-4">
          {/* Paired switch settings */}
          <div className={cn(SETTING_GRID_COLS, 'items-end border-b border-border pb-2 text-[10px] text-muted-foreground')}>
            <span className="pb-0">{t('essenceSettings.settingItem')}</span>
            <span className="px-1 text-center">{t('essenceSettings.weaponList')}</span>
            <span className="pl-1 text-center">{t('essenceSettings.planRec')}</span>
          </div>
          <div className="text-sm">
            {PAIRED_ROWS.flatMap((row) => {
              const listOn = flags[row.listKey]
              const plansOn = flags[row.plansKey]
              const subActive = !!(row.subSetting && (listOn || plansOn))

              const rows = [
                <div key={row.listKey} className={cn(SETTING_GRID_COLS, 'items-center py-2')}>
                  <span className="min-w-0 pr-3 leading-tight">{t(row.labelI18n)}</span>
                  <div className="px-1 text-center">
                    <Switch
                      size="sm"
                      checked={listOn}
                      onCheckedChange={() => toggleFlag(row.listKey)}
                    />
                  </div>
                  <div className="pl-1 text-center">
                    <Switch
                      size="sm"
                      checked={plansOn}
                      onCheckedChange={() => toggleFlag(row.plansKey)}
                    />
                  </div>
                </div>,
              ]

              // Sub-setting row (indented, appears when either parent is ON)
              if (subActive && row.subSetting) {
                rows.push(
                  <div key={row.subSetting.listKey} className={cn(SETTING_GRID_COLS, 'items-center py-1.5')}>
                    <span className="min-w-0 pr-3 pl-6 text-[11px] text-muted-foreground leading-tight">
                      {t(row.subSetting.labelI18n)}
                    </span>
                    <div className="px-1 text-center">
                      <Switch
                        size="sm"
                        checked={flags[row.subSetting.listKey]}
                        disabled={!listOn}
                        onCheckedChange={() => toggleFlag(row.subSetting!.listKey)}
                      />
                    </div>
                    <div className="pl-1 text-center">
                      <Switch
                        size="sm"
                        checked={flags[row.subSetting.plansKey]}
                        disabled={!plansOn}
                        onCheckedChange={() => toggleFlag(row.subSetting!.plansKey)}
                      />
                    </div>
                  </div>
                )
              }

              return rows
            })}
          </div>

          {/* Acquisition category hiding — two multi-select chip groups */}
          <div className="border-t border-border pt-3 mt-2 pb-1">
            <p className="text-xs font-medium text-muted-foreground">{t('essenceSettings.acquisitionCategories')}</p>
            <p className="text-[11px] text-muted-foreground/80 mt-1 mb-2">{t('essenceSettings.acquisitionCategoriesHint')}</p>
            <div className="space-y-3">
              <FilterGroup
                label={t('essenceSettings.weaponList')}
                chipColumnClass="grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))]"
                chips={acquisitionChips('list', hiddenAcquisitionCategoriesList)}
              />
              <FilterGroup
                label={t('essenceSettings.planRec')}
                chipColumnClass="grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))]"
                chips={acquisitionChips('plans', hiddenAcquisitionCategoriesPlans)}
              />
            </div>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="h-px bg-border -mx-4" />

        {/* 地区优先级设置 */}
        <div className="-mx-4 px-4">
          <h3 className="text-sm font-semibold mb-3">{t('essenceSettings.regionPriority')}</h3>

          {/* 排序机制说明 */}
          <div className="rounded-md bg-muted/50 border border-border px-3 py-2.5 mb-3">
            <p className="text-xs font-medium text-foreground mb-1.5">{t('essenceSettings.sortMechanism')}</p>
            <ol className="text-xs text-muted-foreground space-y-0.5">
              <li>{t('essenceSettings.sortRegionStep')}</li>
              <li>{t('essenceSettings.sortSelectedStep')}</li>
              <li>{t('essenceSettings.sortTotalStep')}</li>
            </ol>
          </div>

          {/* 地区优先选择 - 两级 */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm">{t('essenceSettings.regionFirstLabel')}</span>
            <Select
              value={regionFirst ?? 'none'}
              onValueChange={(v) => setRegionFirst(v === 'none' ? null : v)}
            >
              <SelectTrigger className="w-36">
                <SelectValue>
                  {(v: string) =>
                    !v || v === 'none' ? t('essenceSettings.regionNone') : t(regionI18nKey(v))
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('essenceSettings.regionNone')}</SelectItem>
                {REGIONS.map((region) => (
                  <SelectItem key={region} value={region}>
                    {t(regionI18nKey(region))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className={cn('text-sm', !regionFirst && 'text-muted-foreground/40')}>
              {t('essenceSettings.regionSecondLabel')}
            </span>
            <Select
              value={regionSecond ?? 'none'}
              onValueChange={(v) => setRegionSecond(v === 'none' ? null : v)}
              disabled={!regionFirst}
            >
              <SelectTrigger className="w-36">
                <SelectValue>
                  {(v: string) =>
                    !v || v === 'none' ? t('essenceSettings.regionNone') : t(regionI18nKey(v))
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('essenceSettings.regionNone')}</SelectItem>
                {REGIONS.filter((r) => r !== regionFirst).map((region) => (
                  <SelectItem key={region} value={region}>
                    {t(regionI18nKey(region))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

      </DialogContent>
    </Dialog>
  )
}
