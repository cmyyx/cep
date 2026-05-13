'use client'

import { memo, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ElementBadge, RarityStars } from './element-badge'
import { SkillTables } from './skill-tables'
import type { CharacterGuideData, GuideEquipRow, TeamSlot, GuideEquipEntry, TeamSlotOption } from '@/types/character-guide'
import weaponImageMap from '@/data/weapon-image-map.json'
import equipImageMap from '@/data/equip-image-map.json'
import itemImageMap from '@/data/item-image-map.json'

type ViewMode = 'info' | 'guide'

// ---- Image helpers ----

function getWeaponImageSrc(name: string): string | null {
  const imageId = (weaponImageMap as Record<string, string>)[name]
  if (imageId) return `/images/weapon/${imageId}`
  return null
}

function getEquipImageSrc(name: string): string | null {
  const map = equipImageMap as Record<string, string>
  // Exact match
  if (map[name]) return `/images/equip/${map[name]}`
  // Try matching base name (strip ·壹型, ·贰型, ·叁型 suffix)
  const baseName = name.replace(/[·‧]壹型|[·‧]贰型|[·‧]叁型/g, '').trim()
  if (map[baseName]) return `/images/equip/${map[baseName]}`
  // Try fuzzy: find any key that contains the base name
  for (const [key, val] of Object.entries(map)) {
    if (key.includes(baseName) || baseName.includes(key)) {
      return `/images/equip/${val}`
    }
  }
  return null
}

function getItemImageSrc(name: string): string | null {
  // Material names in guide data like "协议圆盘 x8" — extract the item name part
  const cleanName = name.replace(/\s*x\d+$/i, '').replace(/\s*x[\d.]+[kK]?$/i, '').trim()
  const fileName = (itemImageMap as Record<string, string>)[cleanName]
  if (fileName) return `/images/item/${fileName}`
  // Try exact match
  const exactFile = (itemImageMap as Record<string, string>)[name]
  if (exactFile) return `/images/item/${exactFile}`
  return null
}

// ---- Collapsible section ----

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const t = useTranslations()
  return (
    <div className="border-b border-border/20 last:border-b-0">
      <Button
        variant="ghost"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-accent/30 transition-colors group h-auto rounded-none"
      >
        <svg
          className={cn(
            'w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-90'
          )}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6.47 4.47a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06-1.06L9.44 8 6.47 5.03a.75.75 0 0 1 0-1.06Z" />
        </svg>
        <span className="text-sm font-semibold tracking-tight flex-1">{title}</span>
        <span className="text-[10px] text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
          {open ? t('common.collapse') : t('common.expand')}
        </span>
      </Button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}

// ---- Card-style image with frame bg and rarity band (like refinement planner) ----

function GuideCard({
  src,
  alt,
  size = 'md',
  rarity,
}: {
  src: string | null
  alt: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  rarity?: number | null
}) {
  const dimClass = size === 'sm' ? 'w-14 h-14' : size === 'lg' ? 'w-24 h-24' : size === 'xl' ? 'w-28 h-28' : 'w-20 h-20'
  const nameClass = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-xs' : size === 'xl' ? 'text-[13px]' : 'text-[11px]'
  const [imgFailed, setImgFailed] = useState(false)
  const [bandFailed, setBandFailed] = useState(false)
  if (!src) return null
  return (
    <div
      className={cn(
        dimClass,
        'relative shrink-0 rounded-lg overflow-hidden',
        'bg-[url(/images/item-frame-bg.png)] bg-cover bg-center'
      )}
    >
      {!imgFailed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Image
            src={src}
            alt={alt}
            fill
            unoptimized
            sizes={size === 'sm' ? '56px' : size === 'lg' ? '96px' : size === 'xl' ? '112px' : '80px'}
            className="object-contain"
            onError={() => setImgFailed(true)}
          />
        </div>
      )}
      {/* Rarity band */}
      {rarity && !bandFailed && (
        <Image
          src={`/images/item-band-${rarity}.png`}
          alt=""
          width={200}
          height={40}
          unoptimized
          className="absolute -inset-x-px bottom-0 z-20 w-[calc(100%+2px)] max-w-none object-cover object-bottom pointer-events-none"
          onError={() => setBandFailed(true)}
        />
      )}
      {/* Name on image */}
      <div className="absolute bottom-0.5 left-0 right-0 z-30 px-1 text-center">
        <p className={cn('leading-tight font-semibold text-stone-100 truncate drop-shadow-md', nameClass)}>
          {alt}
        </p>
      </div>
    </div>
  )
}

// ---- Equip entry badge ----

const EquipEntryBadge = memo(function EquipEntryBadge({
  entry,
  type,
  size = 'md',
  isRecommended = false,
}: {
  entry: GuideEquipEntry | null
  type: 'weapon' | 'equip'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  isRecommended?: boolean
}) {
  const t = useTranslations()
  if (!entry || !entry.name) {
    return <span className="text-xs text-muted-foreground/40 italic">--</span>
  }
  const imgSrc = type === 'weapon' ? getWeaponImageSrc(entry.name) : getEquipImageSrc(entry.name)
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <div className="relative">
        <GuideCard src={imgSrc} alt={entry.name} size={size} rarity={entry.rarity} />
        {isRecommended && (
          <span className="absolute -top-1 -right-1 z-40 px-1 py-px rounded text-[8px] font-semibold bg-ship-red text-white shadow-sm">
            {t('charGuide.recommended')}
          </span>
        )}
      </div>
      {entry.note && (
        <span className="text-[9px] text-muted-foreground/60">({entry.note})</span>
      )}
    </span>
  )
})

// ---- Equip row display ----

const EquipRowDisplay = memo(function EquipRowDisplay({ row }: { row: GuideEquipRow }) {
  const t = useTranslations()
  const slotLabels = [t('equip.slot.armor'), t('equip.slot.gloves'), t('equip.slot.accessory'), t('equip.slot.accessory2')]
  return (
    <div className="py-3 border-b border-border/15 last:border-b-0">
      {/* Weapons */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-[11px] text-muted-foreground shrink-0 w-10 pt-1">{t('charGuide.weapon')}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-3">
          {row.weapons.length > 0 ? (
            row.weapons.map((w, wi) => (
              <EquipEntryBadge key={wi} entry={w} type="weapon" size="xl" isRecommended={wi === 0 && row.weapons.length > 1} />
            ))
          ) : (
            <span className="text-xs text-muted-foreground/40 italic">--</span>
          )}
        </div>
      </div>
      {/* Equipment slots */}
      <div className="flex flex-wrap gap-x-4 gap-y-3 ml-10">
        {row.equipment.map((eq, ei) => (
          <div key={ei} className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-muted-foreground/50">{slotLabels[ei] || t('team.slot', { number: ei + 1 })}</span>
            {eq ? (
              <EquipEntryBadge entry={eq} type="equip" size="xl" />
            ) : (
              <span className="text-xs text-muted-foreground/30 italic">--</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

// ---- Team slot display ----

const TeamSlotDisplay = memo(function TeamSlotDisplay({
  slot,
  index,
}: {
  slot: TeamSlot
  index: number
}) {
  const t = useTranslations()
  return (
    <div className="py-4 border-b border-border/15 last:border-b-0">
      {/* Position label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-foreground/80 bg-muted px-2 py-0.5 rounded">
          {t('team.slot', { number: index + 1 })}
        </span>
        {slot.name && (
          <span className="text-[11px] text-muted-foreground">{slot.name}</span>
        )}
      </div>
      {/* Options */}
      <div className="space-y-3">
        {slot.options.map((opt, oi) => (
          <div key={oi}>
            <OptionDisplay
              option={opt}
              isRecommended={oi === 0 && slot.options.length > 1}
              isAlternative={oi > 0}
            />
          </div>
        ))}
      </div>
    </div>
  )
})

function OptionDisplay({ option, isRecommended, isAlternative }: { option: TeamSlotOption; isRecommended?: boolean; isAlternative?: boolean }) {
  const t = useTranslations()
  const [avatarFailed, setAvatarFailed] = useState(false)
  return (
    <div className={cn('flex items-start gap-3', isAlternative && 'ml-8 opacity-75')}>
      {isAlternative && (
        <span className="text-[9px] text-muted-foreground/50 shrink-0 mt-2 leading-none">{t('common.or')}</span>
      )}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)] relative">
          {!avatarFailed && (
            <Image
              src={`/images/characters/${option.name}.avif`}
              alt={option.name}
              fill
              unoptimized
              sizes="40px"
              className="object-cover"
              onError={() => setAvatarFailed(true)}
            />
          )}
        </div>
        {isRecommended && (
          <span className="absolute -top-1 -right-1 z-10 px-1 py-px rounded text-[8px] font-semibold bg-ship-red text-white shadow-sm">
            {t('charGuide.recommended')}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-sm font-medium">{option.name}</span>
          {option.tag && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {option.tag}
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          {option.weapons.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {option.weapons.map((w, wi) => (
                <span key={wi} className="inline-flex flex-col items-center gap-0.5">
                  <GuideCard src={getWeaponImageSrc(w.name)} alt={w.name} size="md" rarity={w.rarity} />
                  <span className="text-[11px] text-muted-foreground/70 max-w-[80px] text-center leading-tight">{w.name}</span>
                  {w.note && <span className="text-[9px] text-muted-foreground/60">({w.note})</span>}
                </span>
              ))}
            </div>
          )}
          {option.equipment.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {option.equipment.map((eq, ei) => (
                <span key={ei} className="inline-flex flex-col items-center gap-0.5">
                  <GuideCard src={getEquipImageSrc(eq.name)} alt={eq.name} size="md" rarity={eq.rarity} />
                  <span className="text-[11px] text-muted-foreground/70 max-w-[80px] text-center leading-tight">{eq.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Material display ----

function MaterialItem({ text }: { text: string }) {
  const imgSrc = getItemImageSrc(text)
  const [imgFailed, setImgFailed] = useState(false)
  return (
    <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {imgSrc && !imgFailed && (
        <div className="w-5 h-5 rounded-sm bg-muted/50 shrink-0 flex items-center justify-center overflow-hidden relative">
          <Image
            src={imgSrc}
            alt={text}
            fill
            unoptimized
            sizes="20px"
            className="object-contain"
            onError={() => setImgFailed(true)}
          />
        </div>
      )}
      <span>{text}</span>
    </li>
  )
}

// ====================== MAIN COMPONENT ======================

export const CharacterDetail = memo(function CharacterDetail({
  character,
}: {
  character: CharacterGuideData | null
}) {
  const t = useTranslations()
  const [viewMode, setViewMode] = useState<ViewMode>('info')
  const [cardBgFailed, setCardBgFailed] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)

  if (!character) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        {t('charGuide.selectHint')}
      </div>
    )
  }

  const cardPath = `/images/characters/${character.name}_card.avif`

  return (
    <div className="flex flex-col h-full overflow-y-scroll">
      {/* Header card + basic info */}
      <div className="relative px-4 pt-4 pb-3">
        {/* Card image (partially transparent background) */}
        {!cardBgFailed && (
          <div className="absolute top-0 right-0 w-[36rem] h-[36rem] opacity-18 pointer-events-none select-none">
            <Image
              src={cardPath}
              alt=""
              fill
              unoptimized
              priority
              sizes="576px"
              className="object-contain"
              onError={() => setCardBgFailed(true)}
            />
          </div>
        )}

        <div className="relative z-10 flex items-start gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-muted shrink-0 flex items-center justify-center overflow-hidden shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)] relative">
            {!avatarFailed && (
              <Image
                src={`/images/characters/${character.name}.avif`}
                alt={character.name}
                fill
                unoptimized
                sizes="56px"
                className="object-cover"
                onError={() => setAvatarFailed(true)}
              />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-[-0.96px]">{character.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <RarityStars rarity={character.rarity} size="md" />
              <ElementBadge element={character.element} />
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-sm">
              <span className="text-foreground font-medium">{character.profession}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-foreground/80 font-medium">{character.weaponType}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="text-foreground/70 font-medium">
                {t('charGuide.mainAttr')}: {character.mainAbility}
              </span>
              <span className="text-muted-foreground">|</span>
              <span className="text-foreground/70 font-medium">
                {t('charGuide.subAttr')}: {character.subAbility}
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border/15 relative z-10">
          {(['strength', 'agility', 'intellect', 'will', 'attack', 'hp'] as const).map((key) => (
            <div key={key} className="text-xs">
              <span className="text-muted-foreground">{t(`charGuide.stat_${key}`)}</span>
              <span className="font-geist-mono font-medium ml-1">
                {character.stats[key] || '--'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* View mode toggle */}
      <div className="flex border-b border-border/20 mx-4">
        <Button
          variant="ghost"
          onClick={() => setViewMode('info')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] rounded-none h-auto',
            viewMode === 'info'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {t('charGuide.infoTab')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => setViewMode('guide')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] rounded-none h-auto',
            viewMode === 'guide'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {t('charGuide.guideTab')}
        </Button>
      </div>

      {/* Attributions at top (above both views) */}
      {character.guide?.attributions && character.guide.attributions.length > 0 && (
        <div className="px-4 py-2 border-b border-border/15">
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {character.guide.attributions.map((attr, ai) => (
              <span key={ai}>
                {attr.role && <span className="font-medium mr-1">{attr.role}:</span>}
                {attr.url ? (
                  <a href={attr.url} target="_blank" rel="noopener noreferrer" className="text-develop-blue hover:underline">
                    {attr.name}
                  </a>
                ) : (
                  <span>{attr.name}</span>
                )}
                {attr.note && <span className="ml-1">({attr.note})</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'info' ? (
        <InfoView character={character} />
      ) : (
        <GuideView character={character} />
      )}
    </div>
  )
})

// ====================== INFO VIEW ======================

function InfoView({ character }: { character: CharacterGuideData }) {
  const t = useTranslations()
  return (
    <>
      {/* Skills */}
      <CollapsibleSection title={t('charGuide.skills')}>
        {character.skills.map((skill, si) => (
          <div key={si} className="mb-4 last:mb-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {skill.type}
              </Badge>
              <h4 className="text-sm font-semibold">{skill.name}</h4>
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {skill.description}
            </p>
            {skill.dataTables.length > 0 && <SkillTables tables={skill.dataTables} />}
          </div>
        ))}
      </CollapsibleSection>

      {/* Talents */}
      {character.talents.length > 0 && (
        <CollapsibleSection title={t('charGuide.talents')}>
          {character.talents.map((talent, ti) => (
            <div key={ti} className="mb-2 last:mb-0">
              <h4 className="text-sm font-semibold">{talent.name}</h4>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mt-0.5">
                {talent.description}
              </p>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Base skills */}
      {character.baseSkills.length > 0 && (
        <CollapsibleSection title={t('charGuide.baseSkills')} defaultOpen={false}>
          {character.baseSkills.map((bs, bi) => (
            <div key={bi} className="mb-2 last:mb-0">
              <h4 className="text-sm font-semibold">{bs.name}</h4>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mt-0.5">
                {bs.description}
              </p>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Potentials */}
      {character.potentials.length > 0 && (
        <CollapsibleSection title={t('charGuide.potentials')} defaultOpen={false}>
          {character.potentials.map((pot, pi) => (
            <div key={pi} className="mb-2 last:mb-0">
              <h4 className="text-sm font-semibold">{pot.name}</h4>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mt-0.5">
                {pot.description}
              </p>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Materials */}
      {(character.materials.elite1.length > 0 || character.materials.elite2.length > 0 ||
        character.materials.elite3.length > 0 || character.materials.elite4.length > 0) && (
        <CollapsibleSection title={t('charGuide.materials')} defaultOpen={false}>
          <div className="space-y-2">
            {(['elite1', 'elite2', 'elite3', 'elite4'] as const).map((level) => {
              const items = character.materials[level]
              if (!items.length) return null
              return (
                <div key={level}>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">
                    {t(`charGuide.${level}`)}
                  </h4>
                  <ul className="space-y-1">
                    {items.map((item, ii) => (
                      <MaterialItem key={ii} text={item} />
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </CollapsibleSection>
      )}
    </>
  )
}

// ====================== GUIDE VIEW ======================

function GuideView({ character }: { character: CharacterGuideData }) {
  const t = useTranslations()
  const guide = character.guide

  if (!guide) return null

  return (
    <>
      {/* Analysis */}
      {guide.analysis && (
        <CollapsibleSection title={t('charGuide.analysis')}>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {guide.analysis}
          </p>
        </CollapsibleSection>
      )}

      {/* Team tips */}
      {guide.teamTips && (
        <CollapsibleSection title={t('charGuide.teamTips')} defaultOpen={false}>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {guide.teamTips}
          </p>
        </CollapsibleSection>
      )}

      {/* Operation tips */}
      {guide.operationTips && (
        <CollapsibleSection title={t('charGuide.operationTips')} defaultOpen={false}>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {guide.operationTips}
          </p>
        </CollapsibleSection>
      )}

      {/* Equip rows */}
      {guide.equipRows.length > 0 && (
        <CollapsibleSection title={t('charGuide.equipRec')}>
          {guide.equipRows.map((row, ri) => (
            <EquipRowDisplay key={ri} row={row} />
          ))}
        </CollapsibleSection>
      )}

      {/* Team slots */}
      {guide.teamSlots.length > 0 && (
        <CollapsibleSection title={t('charGuide.teamRec')}>
          {guide.teamSlots.map((slot, si) => (
            <TeamSlotDisplay key={si} slot={slot} index={si} />
          ))}
        </CollapsibleSection>
      )}
    </>
  )
}

