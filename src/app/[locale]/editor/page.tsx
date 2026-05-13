'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEditorStore, type EditorTab } from '@/stores/useEditorStore'
import type { CharacterGuideData } from '@/types/character-guide'
import { EditorBasicTab } from '@/components/editor/editor-basic-tab'
import { EditorSkillsTab } from '@/components/editor/editor-skills-tab'
import { EditorTalentsTab } from '@/components/editor/editor-talents-tab'
import { EditorMaterialsTab } from '@/components/editor/editor-materials-tab'
import { EditorGuideTab } from '@/components/editor/editor-guide-tab'
import { EditorAttributionsTab } from '@/components/editor/editor-attributions-tab'
import { Plus, Download, Upload, Trash2, Lock, GitFork } from 'lucide-react'

const TABS: { key: EditorTab; labelKey: string }[] = [
  { key: 'basic', labelKey: 'editor.tabBasic' },
  { key: 'skills', labelKey: 'editor.tabSkills' },
  { key: 'talents', labelKey: 'editor.tabTalents' },
  { key: 'materials', labelKey: 'editor.tabMaterials' },
  { key: 'guide', labelKey: 'editor.tabGuide' },
  { key: 'attributions', labelKey: 'editor.guideAttributions' },
]

/** Parse imported text (JSON only) into an array of character objects */
function parseImportText(text: string): Record<string, unknown>[] {
  const json = JSON.parse(text)
  return Array.isArray(json) ? json : [json]
}

export default function EditorPage() {
  const t = useTranslations()

  // Editor store
  const draftCharacters = useEditorStore((s) => s.draftCharacters)
  const selectedId = useEditorStore((s) => s.selectedId)
  const activeTab = useEditorStore((s) => s.activeTab)
  const draftVersion = useEditorStore((s) => s.draftVersion)
  const addDraftCharacter = useEditorStore((s) => s.addDraftCharacter)
  const addImportedCharacter = useEditorStore((s) => s.addImportedCharacter)
  const removeDraftCharacter = useEditorStore((s) => s.removeDraftCharacter)
  const setSelectedId = useEditorStore((s) => s.setSelectedId)
  const setActiveTab = useEditorStore((s) => s.setActiveTab)
  const forkCharacter = useEditorStore((s) => s.forkCharacter)

  // Search for character picker
  const [search, setSearch] = useState('')
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  // Stable mount key — only changes on explicit sidebar selection, not on ID edit
  const [mountedDraftKey, setMountedDraftKey] = useState(0)

  // Import file ref
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Export current character as JSON
  const handleExport = useCallback(() => {
    if (!selectedDraft) return
    // Strip internal fields for clean export
    const { isSource: _s, forkedFrom: _f, jsonDrafts: _jd, jsonErrors: _je, ...clean } = selectedDraft as unknown as Record<string, unknown>
    const content = JSON.stringify(clean, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedDraft.id}.json`
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
            addImportedCharacter(d as unknown as CharacterGuideData)
          }
        }
      } catch {
        // ignore import errors
      }
      e.target.value = ''
    },
    [addImportedCharacter]
  )

  const handleNewCharacter = useCallback(() => {
    addDraftCharacter()
    setMountedDraftKey((k) => k + 1)
  }, [addDraftCharacter])

  const handleDelete = useCallback(() => {
    if (!selectedDraft) return
    if (selectedDraft.isSource) return
    if (!confirm(t('editor.deleteConfirm', { name: selectedDraft.name }))) return
    removeDraftCharacter(selectedDraft.id)
    setMountedDraftKey((k) => k + 1)
  }, [selectedDraft, removeDraftCharacter, t])

  const handleFork = useCallback(() => {
    if (!selectedDraft) return
    forkCharacter(selectedDraft.id)
    setMountedDraftKey((k) => k + 1)
  }, [selectedDraft, forkCharacter])

  const selectedIsSource = selectedDraft?.isSource ?? false

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
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
        {selectedIsSource && (
          <Button variant="outline" size="sm" onClick={handleFork}>
            <GitFork className="w-3.5 h-3.5 mr-1" />
            {t('editor.forkCharacter')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!selectedDraft}>
          <Download className="w-3.5 h-3.5 mr-1" />
          {t('editor.exportCurrent')}
        </Button>
        {!selectedIsSource && (
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={!selectedDraft}>
            <Trash2 className="w-3.5 h-3.5 mr-1" />
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground">
          {t('editor.autoSaved')}
        </span>
      </div>

      {/* Content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: character picker */}
        <div className="w-64 shrink-0 border-r border-border/30 flex flex-col">
          <div className="p-2">
            <Input
              placeholder={t('charFilter.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-scroll">
            {filteredDrafts.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">
                {t('charFilter.noMatch')}
              </div>
            ) : (
              filteredDrafts.map((draft) => {
                const isSource = draft.isSource
                return (
                  <button
                    key={draft.id}
                    onClick={() => {
                      setSelectedId(draft.id)
                      setMountedDraftKey((k) => k + 1)
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                      'hover:bg-accent/50',
                      selectedId === draft.id && 'bg-accent'
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-muted shrink-0 flex items-center justify-center overflow-hidden shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)]">
                      {!failedImages.has(draft.id) && (
                        <Image
                          src={`/images/characters/${draft.name}.avif`}
                          alt={draft.name}
                          width={28}
                          height={28}
                          className="object-cover"
                          unoptimized
                          onError={() => setFailedImages((prev) => new Set(prev).add(draft.id))}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate flex items-center gap-1">
                        {draft.name || t('editor.noCharacterSelected')}
                        {isSource && (
                          <Lock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {draft.id}
                        {isSource && (
                          <span className="ml-1 text-[10px] text-muted-foreground/40">({t('editor.readOnly')})</span>
                        )}
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
              {/* Source character warning */}
              {selectedIsSource && (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
                  {t('editor.sourceReadOnly')}{' '}
                  <button onClick={handleFork} className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200">
                    {t('editor.forkToEdit')}
                  </button>
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-border/30 px-2">
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

              {/* Tab content — keyed only by selectedId to preserve input focus */}
              <div className={cn('flex-1 overflow-y-scroll p-4', selectedIsSource && 'opacity-80 pointer-events-none')}>
                {activeTab === 'basic' && <EditorBasicTab key={`${mountedDraftKey}-basic`} draft={selectedDraft} />}
                {activeTab === 'skills' && <EditorSkillsTab key={`${mountedDraftKey}-skills`} draft={selectedDraft} />}
                {activeTab === 'talents' && <EditorTalentsTab key={`${mountedDraftKey}-talents`} draft={selectedDraft} />}
                {activeTab === 'materials' && <EditorMaterialsTab key={`${mountedDraftKey}-materials`} draft={selectedDraft} />}
                {activeTab === 'guide' && <EditorGuideTab key={`${mountedDraftKey}-guide`} draft={selectedDraft} />}
                {activeTab === 'attributions' && <EditorAttributionsTab key={`${mountedDraftKey}-attributions`} draft={selectedDraft} />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
