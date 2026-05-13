'use client'

import { useState, useMemo, memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RarityStars } from './element-badge'
import type { CharacterGuideData } from '@/types/character-guide'

interface CharacterListProps {
  characters: CharacterGuideData[]
  selectedId: string | null
  onSelect: (id: string) => void
}

type FilterKey = 'rarity' | 'element'

export const CharacterList = memo(function CharacterList({
  characters,
  selectedId,
  onSelect,
}: CharacterListProps) {
  const t = useTranslations()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<FilterKey, Set<string>>>({
    rarity: new Set(),
    element: new Set(),
  })

  const filterValues = useMemo(() => {
    const result: Record<FilterKey, string[]> = { rarity: [], element: [] }
    const sets: Record<FilterKey, Set<string>> = { rarity: new Set(), element: new Set() }
    for (const c of characters) {
      sets.rarity.add(String(c.rarity))
      if (c.element) sets.element.add(c.element)
    }
    result.rarity = [...sets.rarity].sort((a, b) => Number(b) - Number(a))
    result.element = [...sets.element].sort()
    return result
  }, [characters])

  const filtered = useMemo(() => {
    let list = characters
    if (search.trim()) {
      const term = search.trim().toLowerCase()
      list = list.filter(
        (c) => c.name.toLowerCase().includes(term) || c.id.toLowerCase().includes(term)
      )
    }
    for (const key of Object.keys(filters) as FilterKey[]) {
      const selected = filters[key]
      if (selected.size > 0) {
        list = list.filter((c) => {
          const val = key === 'rarity' ? String(c.rarity) : c.element
          return selected.has(val)
        })
      }
    }
    return list
  }, [characters, search, filters])

  const toggleFilter = useCallback((key: FilterKey, value: string) => {
    setFilters((prev) => {
      const next = new Set(prev[key])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...prev, [key]: next }
    })
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({ rarity: new Set(), element: new Set() })
  }, [])

  const hasActiveFilters = filters.rarity.size > 0 || filters.element.size > 0

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 pb-2">
        <Input
          placeholder={t('charFilter.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Filter bar */}
      <div className="px-3 pb-2 space-y-1.5">
        {/* Rarity filter */}
        {filterValues.rarity.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground shrink-0 w-8">{t('charFilter.rarity')}</span>
            {filterValues.rarity.map((val) => (
              <Button
                key={val}
                variant="ghost"
                size="sm"
                onClick={() => toggleFilter('rarity', val)}
                className={cn(
                  'px-1.5 py-0 text-[11px] rounded-sm transition-colors h-5',
                  filters.rarity.has(val)
                    ? 'bg-foreground text-background hover:bg-foreground/90'
                    : 'bg-muted hover:bg-muted-foreground/15'
                )}
              >
                {val}★
              </Button>
            ))}
          </div>
        )}
        {/* Element filter */}
        {filterValues.element.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground shrink-0 w-8">{t('charFilter.element')}</span>
            {filterValues.element.map((val) => (
              <Button
                key={val}
                variant="ghost"
                size="sm"
                onClick={() => toggleFilter('element', val)}
                className={cn(
                  'px-1.5 py-0 text-[11px] rounded-sm transition-colors h-5',
                  filters.element.has(val)
                    ? 'bg-foreground text-background hover:bg-foreground/90'
                    : 'bg-muted hover:bg-muted-foreground/15'
                )}
              >
                {val}
              </Button>
            ))}
          </div>
        )}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-[11px] px-2">
            {t('charFilter.clear')}
          </Button>
        )}
      </div>

      {/* Character list */}
      <div className="flex-1 overflow-y-scroll">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">{t('charFilter.noMatch')}</div>
        ) : (
          filtered.map((char) => (
            <Button
              key={char.id}
              variant="ghost"
              onClick={() => onSelect(char.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors h-auto rounded-none',
                'hover:bg-accent/50',
                selectedId === char.id && 'bg-accent'
              )}
            >
              <div className="w-9 h-9 rounded-full bg-muted shrink-0 flex items-center justify-center overflow-hidden shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)]">
                <img
                  src={`/images/characters/${char.name}.avif`}
                  alt={char.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{char.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <RarityStars rarity={char.rarity} />
                  <span className="text-[11px] text-muted-foreground ml-1">{char.element}</span>
                </div>
              </div>
            </Button>
          ))
        )}
      </div>
    </div>
  )
})
