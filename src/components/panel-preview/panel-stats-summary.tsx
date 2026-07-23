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


export function panelStatValueClass(value: string): string {
  return cn(
    'mt-1 max-w-full font-mono font-semibold leading-tight tabular-nums sm:text-base',
    value.length >= 10 ? 'text-[9px]' : value.length >= 8 ? 'text-[10px]' : 'text-xs'
  )
}

export function PanelStatsSummary() {
  const t = useTranslations('panelPreview')
  const locale = useLocale() as WikiLocale
  const { text, enumLabel } = useWikiTranslations()
  const primaryStats = [
    ['strength', t('strength'), '/images/panel-preview/attribute-str.avif'],
    ['agility', t('agility'), '/images/panel-preview/attribute-agi.avif'],
    ['intellect', t('intellect'), '/images/panel-preview/attribute-wisd.avif'],
    ['will', t('will'), '/images/panel-preview/attribute-will.avif'],
  ] as const
  const combatStats = [
    ['hp', t('hp'), '/images/panel-preview/attribute-hp.avif'],
    ['attack', t('attack'), '/images/panel-preview/attribute-atk.avif'],
    ['defense', t('defense'), '/images/panel-preview/attribute-def.avif'],
  ] as const
  const modifierLabels: Record<string, string> = {
    '3': t('defense'),
    '9': t('critRate'),
    '17': t('normalAttackDamage'),
    '28': t('ultimateDamage'),
    '29': t('healingEfficiency'),
    '32': t('skillDamage'),
    '33': t('comboDamage'),
    '44': t('ultimateCharge'),
    '50': t('physicalDamage'),
    '61': t('damageToStaggered'),
    '87': t('artsStrength'),
    Main: t('mainAbility'),
    Sub: t('subAbility'),
    SpellDamageIncrease: t('artsDamage'),
    CrystDamageIncrease: t('crystDamage'),
    PulseDamageIncrease: t('pulseDamage'),
    NaturalDamageIncrease: t('naturalDamage'),
    FireDamageIncrease: t('fireDamage'),
    AllDamageTakenScalar: t('damageReduction'),
    AllSkillDamageIncrease: t('allSkillDamage'),
    FireAndNaturalDamageIncrease: t('fireNaturalDamage'),
    CrystAndPulseDamageIncrease: t('crystPulseDamage'),
    PhysicalDamageTakenScalar: t('physicalDamageReduction'),
    DefenseDamageTakenScalar: t('defenseDamageReduction'),
    FireDamageTakenScalar: t('fireDamageReduction'),
    HealTakenIncrease: t('healingReceived'),
  }
  const contributionLabels = {
    strength: t('strength'),
    agility: t('agility'),
    intellect: t('intellect'),
    will: t('will'),
    defense: t('defense'),
    hp: t('hp'),
    attack: t('attack'),
    physicalDamageReduction: t('physicalDamageReduction'),
    fireDamageReduction: t('fireDamageReduction'),
    healingReceived: t('healingReceived'),
    defenseDamageReduction: t('defenseDamageReduction'),
  }
  const config = usePanelPreviewStore((state) => state.config)
  if (!config) return <div className="flex min-h-72 items-center justify-center rounded-xl bg-muted/35 px-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">{t('selectCharacterHint')}</div>
  const stats = calculatePanelStats(config)
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  return (
    <Card className="overflow-visible">
      <CardHeader><CardTitle>{t('resultTitle')}</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {primaryStats.map(([key, label, icon]) => {
              const value = number.format(stats[key])
              return <div key={key} className="flex min-w-0 flex-col items-center rounded-lg bg-preview-pink/7 px-1 py-2.5 text-center shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-preview-pink)_12%,transparent)] sm:px-1.5 sm:py-3"><span className="flex size-8 items-center justify-center rounded-md bg-foreground sm:size-9"><Image src={icon} alt="" width={68} height={68} className="size-6 object-contain sm:size-7" /></span><p className="mt-1.5 max-w-full truncate text-[11px] text-muted-foreground sm:mt-2 sm:text-xs">{label}</p><p className={panelStatValueClass(value)}>{value}</p></div>
            })}
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {combatStats.map(([key, label, icon]) => <div key={key} className="flex min-w-0 flex-col items-center rounded-lg bg-muted/35 px-1.5 py-2.5 text-center shadow-[var(--shadow-border)] sm:px-2 sm:py-3"><span className="flex size-8 items-center justify-center rounded-md bg-foreground sm:size-9"><Image src={icon} alt="" width={68} height={68} className="size-6 object-contain sm:size-7" /></span><p className="mt-1.5 max-w-full truncate text-[11px] text-muted-foreground sm:mt-2 sm:text-xs">{label}</p><p className="mt-1 max-w-full font-mono text-sm font-semibold leading-tight tabular-nums sm:text-base">{number.format(stats[key])}</p></div>)}
          </div>
        </div>
        {stats.attributeContributions.length > 0 && <section className="space-y-2"><h3 className="text-xs font-semibold text-muted-foreground">{t('attributeContributions')}</h3><div className="space-y-1.5">{stats.attributeContributions.map((contribution) => <div key={`${contribution.source}-${contribution.target}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2 text-sm"><span className="min-w-0 truncate">{t('attributeProvides', { attribute: contributionLabels[contribution.source], effect: contributionLabels[contribution.target] })}</span><span className="shrink-0 font-mono font-medium">+{number.format(contribution.value)}{contribution.isPercent ? '%' : ''}</span></div>)}</div></section>}
        {stats.modifiers.length > 0 && <section className="space-y-2"><h3 className="text-xs font-semibold text-muted-foreground">{t('additionalAttributes')}</h3><div className="space-y-1.5">{stats.modifiers.map((modifier) => <div key={`${modifier.id}-${modifier.isPercent ? 'percent' : 'flat'}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2 text-sm"><span className="min-w-0 truncate">{modifierLabels[modifier.id] ?? enumLabel('attributes', modifier.id)}</span><span className="shrink-0 font-mono font-medium">+{number.format(modifier.value)}{modifier.isPercent ? '%' : ''}</span></div>)}</div></section>}
        {stats.setEffects.length > 0 && <section className="space-y-2"><h3 className="text-xs font-semibold text-muted-foreground">{t('activeSetEffects')}</h3><div className="space-y-2">{stats.setEffects.map((effect) => <div key={effect.id} className="rounded-lg bg-muted/35 p-3"><div className="flex items-center justify-between gap-3"><span className="font-medium">{text('equipment', effect.equipmentId, 'effect', effect.id, 'name')}</span><span className="font-mono text-xs text-muted-foreground">{t('setPieceProgress', { current: effect.pieceCount, required: effect.requiredPieces })}</span></div><WikiRichText value={text('equipment', effect.equipmentId, 'effect', effect.id, 'description')} className="mt-1 block text-xs leading-relaxed text-muted-foreground" /></div>)}</div></section>}
      </CardContent>
    </Card>
  )
}
