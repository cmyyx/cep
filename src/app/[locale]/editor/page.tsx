'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEditorStore, type EditorTab } from '@/stores/useEditorStore'
import { useCharacterGuideStore } from '@/stores/useCharacterGuideStore'
import { EditorBasicTab } from '@/components/editor/editor-basic-tab'
import { EditorSkillsTab } from '@/components/editor/editor-skills-tab'
import { EditorTalentsTab } from '@/components/editor/editor-talents-tab'
import { EditorMaterialsTab } from '@/components/editor/editor-materials-tab'
import { EditorGuideTab } from '@/components/editor/editor-guide-tab'
import { EditorAttributionsTab } from '@/components/editor/editor-attributions-tab'
import { Plus, Download, Upload, Trash2, Save, Check } from 'lucide-react'

const TABS: { key: EditorTab; labelKey: string }[] = [
  { key: 'basic', labelKey: 'editor.tabBasic' },
  { key: 'skills', labelKey: 'editor.tabSkills' },
  { key: 'talents', labelKey: 'editor.tabTalents' },
  { key: 'materials', labelKey: 'editor.tabMaterials' },
  { key: 'guide', labelKey: 'editor.tabGuide' },
  { key: 'attributions', labelKey: 'editor.guideAttributions' },
]

/** Parse imported text (JSON or IIFE script) into an array of character objects */
function parseImportText(text: string): Record<string, unknown>[] {
  try {
    const json = JSON.parse(text)
    return Array.isArray(json) ? json : [json]
  } catch {
    // Try IIFE format
    const sandbox: { characters: Record<string, unknown>[] } = { characters: [] }
    const sandboxWindow = { characters: sandbox.characters }
    const fn = new Function('window', `${text}\nreturn window.characters;`)
    const result = fn(sandboxWindow)
    return Array.isArray(result) ? result : sandbox.characters
  }
}

export default function EditorPage() {
  const t = useTranslations()

  // Editor store
  const draftCharacters = useEditorStore((s) => s.draftCharacters)
  const selectedId = useEditorStore((s) => s.selectedId)
  const dirtyIds = useEditorStore((s) => s.dirtyIds)
  const activeTab = useEditorStore((s) => s.activeTab)
  const initDrafts = useEditorStore((s) => s.initDrafts)
  const addDraftCharacter = useEditorStore((s) => s.addDraftCharacter)
  const removeDraftCharacter = useEditorStore((s) => s.removeDraftCharacter)
  const setSelectedId = useEditorStore((s) => s.setSelectedId)
  const setActiveTab = useEditorStore((s) => s.setActiveTab)
  const draftVersion = useEditorStore((s) => s.draftVersion)
  const markClean = useEditorStore((s) => s.markClean)

  // Guide store (source of truth)
  const guideCharacters = useCharacterGuideStore((s) => s.characters)
  const upsertCharacter = useCharacterGuideStore((s) => s.upsertCharacter)
  const setGuideCharacters = useCharacterGuideStore((s) => s.setCharacters)

  // Search for character picker
  const [search, setSearch] = useState('')

  // Import file ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize drafts from guide store on mount
  useEffect(() => {
    if (draftCharacters.length === 0 && guideCharacters.length > 0) {
      initDrafts(guideCharacters)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter drafts by search
  const filteredDrafts = useMemo(() => {
    if (!search.trim()) return draftCharacters
    const term = search.trim().toLowerCase()
    return draftCharacters.filter(
      (c) => c.name.toLowerCase().includes(term) || c.id.includes(term)
    )
  }, [draftCharacters, search])

  const selectedDraft = useMemo(
    () => draftCharacters.find((c) => c.id === selectedId) ?? null,
    [draftCharacters, selectedId]
  )

  // Save current draft to guide store
  const handleSave = useCallback(() => {
    if (!selectedDraft) return
    upsertCharacter(selectedDraft)
    markClean(selectedDraft.id)
  }, [selectedDraft, upsertCharacter, markClean])

  // Save all drafts
  const handleSaveAll = useCallback(() => {
    const currentChars = [...guideCharacters]
    for (const draft of draftCharacters) {
      const idx = currentChars.findIndex((c) => c.id === draft.id)
      if (idx >= 0) {
        currentChars[idx] = draft
      } else {
        currentChars.push(draft)
      }
    }
    setGuideCharacters(currentChars)
    // Mark all clean
    for (const id of dirtyIds) {
      markClean(id)
    }
  }, [draftCharacters, guideCharacters, setGuideCharacters, dirtyIds, markClean])

  // Export current character
  const handleExport = useCallback(() => {
    if (!selectedDraft) return
    const content = `(function () {\n  window.characters = window.characters || [];\n  window.characters.push(${JSON.stringify(selectedDraft, null, 2)});\n})();\n`
    const blob = new Blob([content], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `character-${selectedDraft.id}.js`
    a.click()
    URL.revokeObjectURL(url)
  }, [selectedDraft])

  // Import file
  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const parsed = parseImportText(text)
        for (const d of parsed) {
          if (typeof d === 'object' && d && 'id' in d && 'name' in d) {
            upsertCharacter(d as unknown as Parameters<typeof upsertCharacter>[0])
          }
        }
        const updated = useCharacterGuideStore.getState().characters
        initDrafts(updated)
      } catch {
        // ignore import errors
      }
      e.target.value = ''
    },
    [upsertCharacter, initDrafts]
  )

  const handleNewCharacter = useCallback(() => {
    addDraftCharacter()
  }, [addDraftCharacter])

  const handleDelete = useCallback(() => {
    if (!selectedDraft) return
    if (!confirm(t('editor.deleteConfirm', { name: selectedDraft.name }))) return
    removeDraftCharacter(selectedDraft.id)
  }, [selectedDraft, removeDraftCharacter, t])

  const dirtyCount = dirtyIds.size

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)]">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">{t('editor.title')}</h1>
        <div className="flex-1" />
        {/* Action buttons */}
        <Button variant="outline" size="sm" onClick={handleNewCharacter}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t('editor.newCharacter')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-3.5 h-3.5 mr-1" />
          {t('editor.importFile')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".js,.json"
          className="hidden"
          onChange={handleImport}
        />
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!selectedDraft}>
          <Download className="w-3.5 h-3.5 mr-1" />
          {t('editor.exportCurrent')}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete} disabled={!selectedDraft}>
          <Trash2 className="w-3.5 h-3.5 mr-1" />
        </Button>
        <Button
          variant={dirtyCount > 0 ? 'default' : 'ghost'}
          size="sm"
          onClick={dirtyCount > 1 ? handleSaveAll : handleSave}
          disabled={dirtyCount === 0}
        >
          {dirtyCount === 0 ? (
            <Check className="w-3.5 h-3.5 mr-1" />
          ) : (
            <Save className="w-3.5 h-3.5 mr-1" />
          )}
          {dirtyCount === 0 ? t('editor.saved') : `${t('editor.save')}${dirtyCount > 1 ? ` (${dirtyCount})` : ''}`}
        </Button>
      </div>

      {/* Content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: character picker */}
        <div className="w-64 shrink-0 border-r border-border/30 flex flex-col bg-background">
          <div className="p-2">
            <Input
              placeholder={t('charFilter.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredDrafts.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">
                {t('charFilter.noMatch')}
              </div>
            ) : (
              filteredDrafts.map((draft) => {
                const d = dirtyIds.has(draft.id)
                return (
                  <button
                    key={draft.id}
                    onClick={() => {
                      setSelectedId(draft.id)
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                      'hover:bg-accent/50',
                      selectedId === draft.id && 'bg-accent'
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-muted shrink-0 flex items-center justify-center overflow-hidden shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)]">
                      <img
                        src={`/images/characters/${draft.name}.avif`}
                        alt={draft.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate flex items-center gap-1">
                        {draft.name || t('editor.noCharacterSelected')}
                        {d && (
                          <span className="w-1.5 h-1.5 rounded-full bg-ship-red shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {draft.id}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right: editor area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!selectedDraft ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {t('editor.noCharacterSelected')}
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-border/30 bg-background px-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px]',
                      activeTab === tab.key
                        ? 'border-foreground text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t(tab.labelKey)}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'basic' && <EditorBasicTab key={`${selectedId}-${draftVersion}`} draft={selectedDraft} />}
                {activeTab === 'skills' && <EditorSkillsTab key={`${selectedId}-${draftVersion}`} draft={selectedDraft} />}
                {activeTab === 'talents' && <EditorTalentsTab key={`${selectedId}-${draftVersion}`} draft={selectedDraft} />}
                {activeTab === 'materials' && <EditorMaterialsTab key={`${selectedId}-${draftVersion}`} draft={selectedDraft} />}
                {activeTab === 'guide' && <EditorGuideTab key={`${selectedId}-${draftVersion}`} draft={selectedDraft} />}
                {activeTab === 'attributions' && <EditorAttributionsTab key={`${selectedId}-${draftVersion}`} draft={selectedDraft} />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
