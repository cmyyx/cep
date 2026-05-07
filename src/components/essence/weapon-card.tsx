'use client'

import { cn } from '@/lib/utils'
import Image from 'next/image'
import type { Weapon } from '@/types/matrix'

interface WeaponCardProps {
  weapon: Weapon
  isSelected: boolean
  onToggle: () => void
  disabled?: boolean
}

export function WeaponCard({ weapon, isSelected, onToggle, disabled }: WeaponCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'group relative flex items-center justify-center aspect-square rounded-lg border cursor-pointer overflow-hidden transition-all',
        'bg-[url(/images/item-frame-bg.png)] bg-cover bg-center',
        disabled && 'opacity-30 cursor-not-allowed pointer-events-none',
        !disabled && [
          isSelected
            ? 'border-amber-400 ring-2 ring-amber-400/50 ring-offset-2 ring-offset-background shadow-2xl'
            : 'border-border hover:ring-2 hover:ring-white/40',
        ],
      )}
    >
      {/* Weapon art */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <Image
          src={`/images/weapons/${weapon.imageId || 'wpn_sword_0001'}.avif`}
          alt={weapon.name}
          fill
          className="object-cover"
          unoptimized
          loading="lazy"
        />
      </div>

      {/* Character avatars */}
      {weapon.chars.length > 0 && (
        <div className="absolute top-2 left-2 flex gap-1 z-20">
          {weapon.chars.map((char) => (
            <div
              key={char}
              className="relative size-6 rounded-full bg-black/60 border border-white/35 shadow-md overflow-hidden"
            >
              <Image
                src={`/images/characters/${char}.avif`}
                alt={char}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ))}
        </div>
      )}

      {/* Rarity band image */}
      <Image
        src={`/images/item-band-${weapon.rarity}.png`}
        alt=""
        width={200}
        height={40}
        className="absolute -inset-x-px bottom-0 z-20 w-[calc(100%+2px)] max-w-none object-cover object-bottom pointer-events-none"
        unoptimized
      />

      {/* Weapon name */}
      <div className="absolute bottom-2 left-0 right-0 z-30 px-2 text-center">
        <p className="text-sm leading-tight font-semibold text-stone-100 truncate drop-shadow-md">
          {weapon.name}
        </p>
      </div>

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 size-5 rounded-full bg-amber-400 flex items-center justify-center z-30 shadow-md">
          <span className="text-[10px] text-black font-bold">✓</span>
        </div>
      )}
    </button>
  )
}
