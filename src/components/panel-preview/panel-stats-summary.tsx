'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Activity, HeartPulse, Shield, Sparkles, Swords } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePanelPreviewStore } from '@/stores/usePanelPreviewStore'
import { calculatePanelStats } from '@/lib/planner/progression'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import { WikiRichText } from '@/components/wiki/wiki-rich-text'
import type { WikiLocale } from '@/types/wiki'


export function PanelStatsSummary() {
  const t = useTranslations('panelPreview')
  const locale = useLocale() as WikiLocale
  const { text } = useWikiTranslations()
  const statMeta = [
    ['strength', t('strength'), Swords],
    ['agility', t('agility'), Activity],
    ['intellect', t('intellect'), Sparkles],
    ['will', t('will'), Shield],
    ['hp', t('hp'), HeartPulse],
    ['defense', t('defense'), Shield],
    ['attack', t('attack'), Swords],
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">{statMeta.map(([key, label, Icon]) => <div key={key} className="rounded-xl bg-preview-pink/7 p-3 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-preview-pink)_12%,transparent)]"><Icon className="size-4 text-preview-pink" /><p className="mt-5 text-xs text-muted-foreground">{label}</p><p className="mt-1 font-mono text-xl font-semibold tracking-[-0.8px]">{number.format(stats[key])}</p></div>)}</div>
        {stats.attributeContributions.length > 0 && <section className="space-y-2"><h3 className="text-xs font-semibold text-muted-foreground">{t('attributeContributions')}</h3><div className="space-y-1.5">{stats.attributeContributions.map((contribution) => <div key={`${contribution.source}-${contribution.target}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2 text-sm"><span className="min-w-0 truncate">{t('attributeProvides', { attribute: contributionLabels[contribution.source], effect: contributionLabels[contribution.target] })}</span><span className="shrink-0 font-mono font-medium">+{number.format(contribution.value)}{contribution.isPercent ? '%' : ''}</span></div>)}</div></section>}
        {stats.modifiers.length > 0 && <section className="space-y-2"><h3 className="text-xs font-semibold text-muted-foreground">{t('additionalAttributes')}</h3><div className="space-y-1.5">{stats.modifiers.map((modifier) => <div key={`${modifier.id}-${modifier.isPercent ? 'percent' : 'flat'}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2 text-sm"><span className="min-w-0 truncate">{modifierLabels[modifier.id] ?? modifier.id}</span><span className="shrink-0 font-mono font-medium">+{number.format(modifier.value)}{modifier.isPercent ? '%' : ''}</span></div>)}</div></section>}
        {stats.setEffects.length > 0 && <section className="space-y-2"><h3 className="text-xs font-semibold text-muted-foreground">{t('activeSetEffects')}</h3><div className="space-y-2">{stats.setEffects.map((effect) => <div key={effect.id} className="rounded-lg bg-muted/35 p-3"><div className="flex items-center justify-between gap-3"><span className="font-medium">{text('equipment', effect.equipmentId, 'effect', effect.id, 'name')}</span><span className="font-mono text-xs text-muted-foreground">{t('setPieceProgress', { current: effect.pieceCount, required: effect.requiredPieces })}</span></div><WikiRichText value={text('equipment', effect.equipmentId, 'effect', effect.id, 'description')} className="mt-1 block text-xs leading-relaxed text-muted-foreground" /></div>)}</div></section>}
      </CardContent>
    </Card>
  )
}
