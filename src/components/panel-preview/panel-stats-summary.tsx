'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePanelPreviewStore } from '@/stores/usePanelPreviewStore'
import { calculatePanelStats } from '@/lib/planner/progression'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import { cn } from '@/lib/utils'
import { WikiRichText } from '@/components/wiki/wiki-rich-text'
import type { WikiLocale } from '@/types/wiki'

/** Core panel stats → game attribute enum ids. */
const CORE_STAT_ATTR_ID = {
  strength: '39',
  agility: '40',
  intellect: '41',
  will: '42',
  hp: '1',
  attack: '2',
  defense: '3',
} as const

type CoreStatKey = keyof typeof CORE_STAT_ATTR_ID

/** Contribution effect keys → attribute enum id, or composite equipStat key. */
const CONTRIBUTION_TARGET_LABEL_ID: Record<string, string> = {
  hp: '1',
  attack: '2',
  physicalDamageReduction: '4',
  fireDamageReduction: '5',
  healingReceived: '30',
  /** Defense-derived damage reduction; closest game composite label. */
  defenseDamageReduction: 'AllDamageTakenScalar',
}

export function panelStatValueClass(value: string): string {
  return cn(
    'mt-1 max-w-full font-mono font-semibold leading-tight tabular-nums sm:text-base',
    value.length >= 10 ? 'text-[9px]' : value.length >= 8 ? 'text-[10px]' : 'text-xs'
  )
}

export function PanelStatsSummary() {
  const t = useTranslations('panelPreview')
  const locale = useLocale() as WikiLocale
  const { text, enumLabel, equipmentStatLabel } = useWikiTranslations()

  const coreLabel = (key: CoreStatKey) => enumLabel('attributes', CORE_STAT_ATTR_ID[key])

  const contributionLabel = (key: string): string => {
    if (key in CORE_STAT_ATTR_ID) return coreLabel(key as CoreStatKey)
    const mapped = CONTRIBUTION_TARGET_LABEL_ID[key]
    if (!mapped) return equipmentStatLabel(key)
    if (/^\d+$/.test(mapped)) return enumLabel('attributes', mapped)
    return equipmentStatLabel(mapped)
  }

  const primaryStats = [
    ['strength', coreLabel('strength'), '/images/panel-preview/attribute-str.avif'],
    ['agility', coreLabel('agility'), '/images/panel-preview/attribute-agi.avif'],
    ['intellect', coreLabel('intellect'), '/images/panel-preview/attribute-wisd.avif'],
    ['will', coreLabel('will'), '/images/panel-preview/attribute-will.avif'],
  ] as const

  const combatStats = [
    ['hp', coreLabel('hp'), '/images/panel-preview/attribute-hp.avif'],
    ['attack', coreLabel('attack'), '/images/panel-preview/attribute-atk.avif'],
    ['defense', coreLabel('defense'), '/images/panel-preview/attribute-def.avif'],
  ] as const

  const config = usePanelPreviewStore((state) => state.config)
  if (!config) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-xl bg-muted/35 px-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
        {t('selectCharacterHint')}
      </div>
    )
  }
  const stats = calculatePanelStats(config)
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle>{t('resultTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {primaryStats.map(([key, label, icon]) => {
              const value = number.format(stats[key])
              return (
                <div
                  key={key}
                  className="flex min-w-0 flex-col items-center rounded-lg bg-preview-pink/7 px-1 py-2.5 text-center shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-preview-pink)_12%,transparent)] sm:px-1.5 sm:py-3"
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-foreground sm:size-9">
                    <Image src={icon} alt="" width={68} height={68} className="size-6 object-contain sm:size-7" />
                  </span>
                  <p className="mt-1.5 max-w-full truncate text-[11px] text-muted-foreground sm:mt-2 sm:text-xs">{label}</p>
                  <p className={panelStatValueClass(value)}>{value}</p>
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {combatStats.map(([key, label, icon]) => (
              <div
                key={key}
                className="flex min-w-0 flex-col items-center rounded-lg bg-muted/35 px-1.5 py-2.5 text-center shadow-[var(--shadow-border)] sm:px-2 sm:py-3"
              >
                <span className="flex size-8 items-center justify-center rounded-md bg-foreground sm:size-9">
                  <Image src={icon} alt="" width={68} height={68} className="size-6 object-contain sm:size-7" />
                </span>
                <p className="mt-1.5 max-w-full truncate text-[11px] text-muted-foreground sm:mt-2 sm:text-xs">{label}</p>
                <p className="mt-1 max-w-full font-mono text-sm font-semibold leading-tight tabular-nums sm:text-base">
                  {number.format(stats[key])}
                </p>
              </div>
            ))}
          </div>
        </div>

        {stats.attributeContributions.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground">{t('attributeContributions')}</h3>
            <div className="space-y-1.5">
              {stats.attributeContributions.map((contribution) => (
                <div
                  key={`${contribution.source}-${contribution.target}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {t('attributeProvides', {
                      attribute: contributionLabel(contribution.source),
                      effect: contributionLabel(contribution.target),
                    })}
                  </span>
                  <span className="shrink-0 font-mono font-medium">
                    +{number.format(contribution.value)}
                    {contribution.isPercent ? '%' : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {stats.modifiers.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground">{t('additionalAttributes')}</h3>
            <div className="space-y-1.5">
              {stats.modifiers.map((modifier) => (
                <div
                  key={`${modifier.id}-${modifier.isPercent ? 'percent' : 'flat'}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {equipmentStatLabel(modifier.id) || enumLabel('attributes', modifier.id)}
                  </span>
                  <span className="shrink-0 font-mono font-medium">
                    +{number.format(modifier.value)}
                    {modifier.isPercent ? '%' : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {stats.setEffects.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground">{t('activeSetEffects')}</h3>
            <div className="space-y-2">
              {stats.setEffects.map((effect) => (
                <div key={effect.id} className="rounded-lg bg-muted/35 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{text('equipment', effect.equipmentId, 'effect', effect.id, 'name')}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {t('setPieceProgress', { current: effect.pieceCount, required: effect.requiredPieces })}
                    </span>
                  </div>
                  <WikiRichText
                    value={text('equipment', effect.equipmentId, 'effect', effect.id, 'description')}
                    className="mt-1 block text-xs leading-relaxed text-muted-foreground"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  )
}
