'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, LoaderCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { GAME_I18N_LOCALES, type GameI18nLocale } from '@/lib/game-i18n-shared'
import { loadGameI18nManifest, searchGameI18n, type GameI18nSearchHit } from '@/lib/game-i18n-lookup'
import { cn } from '@/lib/utils'

const LOCALE_LABEL_KEYS: Record<GameI18nLocale, string> = {
  'zh-CN': 'localeZhCN',
  en: 'localeEn',
  ja: 'localeJa',
  'zh-TW': 'localeZhTW',
}

export function GameI18nLookupPanel() {
  const t = useTranslations('gameI18nLookup')
  const [searchLocale, setSearchLocale] = useState<GameI18nLocale>('zh-CN')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [hits, setHits] = useState<GameI18nSearchHit[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ loaded: number; total: number; hits: number } | null>(null)
  const [manifestReady, setManifestReady] = useState(false)
  const [entryCount, setEntryCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [, startTransition] = useTransition()
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 280)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    void loadGameI18nManifest()
      .then((manifest) => {
        if (cancelled) return
        startTransition(() => {
          setManifestReady(true)
          setEntryCount(manifest.locales['zh-CN']?.entryCount ?? 0)
          setError(null)
        })
      })
      .catch(() => {
        if (cancelled) return
        startTransition(() => {
          setManifestReady(false)
          setError(t('manifestMissing'))
        })
      })
    return () => {
      cancelled = true
    }
  }, [t, startTransition])

  useEffect(() => {
    abortRef.current?.abort()
    if (!debouncedQuery || !manifestReady) return

    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestIdRef.current

    startTransition(() => {
      setLoading(true)
      setError(null)
      setProgress({ loaded: 0, total: 1, hits: 0 })
    })

    void searchGameI18n({
      searchLocale,
      query: debouncedQuery,
      limit: 80,
      signal: controller.signal,
      onLoadProgress: (loaded, total) => {
        if (requestId !== requestIdRef.current) return
        startTransition(() => {
          setProgress((current) => ({ loaded, total, hits: current?.hits ?? 0 }))
        })
      },
      onSearchProgress: (loaded, total, hitCount) => {
        if (requestId !== requestIdRef.current) return
        startTransition(() => {
          setProgress({ loaded, total, hits: hitCount })
        })
      },
    })
      .then((results) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return
        startTransition(() => {
          setHits(results)
          setSelectedId(results[0]?.textId ?? null)
          setLoading(false)
        })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return
        startTransition(() => {
          setLoading(false)
          setHits([])
          setError(err instanceof Error ? err.message : t('searchFailed'))
        })
      })

    return () => controller.abort()
  }, [debouncedQuery, searchLocale, manifestReady, t, startTransition])

  const visibleHits = debouncedQuery && manifestReady ? hits : []
  const selected = visibleHits.find((hit) => hit.textId === selectedId) ?? null

  const copyTextId = useCallback(async () => {
    if (!selected) return
    try {
      await navigator.clipboard.writeText(selected.textId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }, [selected])

  const localeLabel = (locale: GameI18nLocale) => t(LOCALE_LABEL_KEYS[locale])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
      <div className="shrink-0 space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-[10rem] gap-1.5">
            <Label htmlFor="game-i18n-locale">{t('searchLocale')}</Label>
            <Select value={searchLocale} onValueChange={(value) => value && setSearchLocale(value as GameI18nLocale)}>
              <SelectTrigger id="game-i18n-locale" className="w-[12rem]">
                <SelectValue>{(value: string) => localeLabel((value as GameI18nLocale) || searchLocale)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {GAME_I18N_LOCALES.map((locale) => (
                  <SelectItem key={locale} value={locale}>
                    {localeLabel(locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor="game-i18n-query">{t('query')}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="game-i18n-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('queryPlaceholder')}
                className="pl-9"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {manifestReady ? <span>{t('entryCount', { count: entryCount.toLocaleString() })}</span> : null}
          {loading ? (
            <span className="inline-flex items-center gap-1">
              <LoaderCircle className="size-3.5 animate-spin" />
              {progress
                ? t('searchProgress', { loaded: progress.loaded, total: progress.total, hits: progress.hits })
                : t('searching')}
            </span>
          ) : null}
          {!loading && debouncedQuery && visibleHits.length > 0 ? (
            <span>{t('resultCount', { count: visibleHits.length })}</span>
          ) : null}
          {!loading && debouncedQuery && visibleHits.length === 0 && !error ? <span>{t('noResults')}</span> : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-h-0 overflow-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[12rem]">{t('textId')}</TableHead>
                <TableHead>{t('matchedText')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleHits.map((hit) => {
                const preview = hit.texts[searchLocale] ?? Object.values(hit.texts)[0] ?? ''
                const active = hit.textId === selectedId
                return (
                  <TableRow
                    key={hit.textId}
                    className={cn('cursor-pointer', active && 'bg-muted/50')}
                    onClick={() => setSelectedId(hit.textId)}
                  >
                    <TableCell className="font-mono text-xs break-all">{hit.textId}</TableCell>
                    <TableCell className="max-w-0 truncate text-sm">{preview}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <div className="min-h-0 overflow-auto rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
          {selected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t('textId')}</Badge>
                <code className="font-mono text-xs break-all">{selected.textId}</code>
                <Button type="button" size="sm" variant="outline" onClick={copyTextId}>
                  <Copy className="size-3.5" />
                  {copied ? t('copied') : t('copyId')}
                </Button>
              </div>
              <div className="space-y-3">
                {GAME_I18N_LOCALES.map((locale) => (
                  <div key={locale} className="rounded-lg bg-muted/35 p-3">
                    <div className="text-xs font-medium text-muted-foreground">{localeLabel(locale)}</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm break-words">
                      {selected.texts[locale] ?? t('missingTranslation')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('detailEmpty')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
