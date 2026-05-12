'use client'

import { useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { CharacterList } from '@/components/character-guide/character-list'
import { CharacterDetail } from '@/components/character-guide/character-detail'
import { useCharacterGuideStore } from '@/stores/useCharacterGuideStore'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { List } from 'lucide-react'
import { useState } from 'react'

export default function CharacterGuidePage() {
  const t = useTranslations()
  const characters = useCharacterGuideStore((s) => s.characters)
  const selectedId = useCharacterGuideStore((s) => s.selectedId)
  const setSelectedId = useCharacterGuideStore((s) => s.setSelectedId)

  // Mobile: sheet for character list
  const [mobileListOpen, setMobileListOpen] = useState(false)

  // Auto-select first character on initial load
  useEffect(() => {
    if (!selectedId && characters.length > 0) {
      setSelectedId(characters[0].id)
    }
  }, [characters, selectedId, setSelectedId])

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id)
      setMobileListOpen(false)
    },
    [setSelectedId]
  )

  const selectedCharacter = characters.find((c) => c.id === selectedId) ?? null

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)]">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('nav.characterGuide')}
        </h1>
        {/* Mobile list toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden ml-auto h-7 w-7 p-0"
          onClick={() => setMobileListOpen(true)}
        >
          <List className="w-4 h-4" />
        </Button>
      </div>

      {/* Content area — two column layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left column: character list (desktop) */}
        <div className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/30 overflow-hidden bg-background">
          <CharacterList
            characters={characters}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </div>

        {/* Right column: character detail */}
        <div className="flex-1 min-w-0">
          <CharacterDetail character={selectedCharacter} />
        </div>
      </div>

      {/* Mobile: character list in a sheet */}
      <Sheet open={mobileListOpen} onOpenChange={setMobileListOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-3 py-2.5 border-b border-border/30">
            <SheetTitle className="text-sm font-semibold">
              {t('nav.characterGuide')}
            </SheetTitle>
          </SheetHeader>
          <div className="h-full">
            <CharacterList
              characters={characters}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
