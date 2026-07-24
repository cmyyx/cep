'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, LoaderCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { GAME_I18N_LOCALES, type GameI18nLocale } from '@/lib/game-i18n-shared'
import {
  areAllGameI18nLocalesLoaded,
  loadGameI18nManifest,
  prefetchAllGameI18nLocales,
  searchGameI18n,
  type GameI18nAllLoadProgress,
  type GameI18nSearchHit,
} from '@/lib/game-i18n-lookup'
import { cn } from '@/lib/utils'

const LOCALE_LABEL_KEYS: Record<GameI18nLocale, string> = {
  'zh-CN': 'localeZhCN',
  en: 'localeEn',
  ja: 'localeJa',
  'zh-TW': 'localeZhTW',
  ko: 'localeKo',
  de: 'localeDe',
  fr: 'localeFr',
  it: 'localeIt',
  ru: 'localeRu',
  'pt-BR': 'localePtBR',
  'es-MX': 'localeEsMX',
  id: 'localeId',
  th: 'localeTh',
  vi: 'localeVi',
}

/** Exit animation duration for result list/detail when the query changes. */
const RESULT_EXIT_MS = 200

type PrefetchState = {
  loadedLocales: number
  totalLocales: number
  loadedBytes: number
  totalBytes: number
  readyLocales: GameI18nLocale[]
  activeLocale: GameI18nLocale | null
  ready: boolean
}

type DisplayedResults = {
  /** Identity for the result set (query + search locale). */
  key: string
  query: string
  searchLocale: GameI18nLocale
  hits: GameI18nSearchHit[]
  selectedId: string | null
  phase: 'in' | 'out'
}

function percentOf(loaded: number, total: number): number {
  if (total <= 0) return 100
  return Math.min(100, Math.round((loaded / total) * 100))
}

function resultsKey(query: string, locale: GameI18nLocale): string {
  return `${locale}::${query}`
}

export function GameI18nLookupPanel() {
  const t = useTranslations('gameI18nLookup')
  const [searchLocale, setSearchLocale] = useState<GameI18nLocale>('zh-CN')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [hits, setHits] = useState<GameI18nSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [resolving, setResolving] = useState(false)
  /** Query string for which the latest search has settled (success or empty). */
  const [settledQuery, setSettledQuery] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchProgress, setSearchProgress] = useState<{ loaded: number; total: number; hits: number } | null>(null)
  const [resolveProgress, setResolveProgress] = useState<{ done: number; total: number } | null>(null)
  const [manifestReady, setManifestReady] = useState(false)
  const [entryCount, setEntryCount] = useState(0)
  const [prefetch, setPrefetch] = useState<PrefetchState | null>(null)
  const [copied, setCopied] = useState(false)
  /** What the result panels currently render (supports exit animation across query changes). */
  const [displayed, setDisplayed] = useState<DisplayedResults | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const prefetchAbortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const prefetchIdRef = useRef(0)
  const exitTimerRef = useRef<number | null>(null)
  const displayedRef = useRef<DisplayedResults | null>(null)
  /** Newest enter payload waiting for the current exit animation to finish. */
  const pendingEnterRef = useRef<DisplayedResults | null>(null)

  useEffect(() => {
    displayedRef.current = displayed
  }, [displayed])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
    }
  }, [])

  const allLocalesReady = Boolean(prefetch?.ready) || areAllGameI18nLocalesLoaded()
  const allLocalesLoading = manifestReady && !allLocalesReady
  const loadPercent = prefetch ? percentOf(prefetch.loadedBytes, prefetch.totalBytes) : 0

  // Derived: query changed / not yet settled for this query → do not show "no results".
  const searchPendingForQuery =
    Boolean(debouncedQuery) && allLocalesReady && settledQuery !== debouncedQuery
  const showNoResults =
    Boolean(debouncedQuery) &&
    allLocalesReady &&
    settledQuery === debouncedQuery &&
    !searching &&
    !resolving &&
    hits.length === 0 &&
    !error

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
  }, [])

  /**
   * Play exit animation for the currently displayed result set, then clear it.
   * Concurrent callers share the same exit cycle via pendingEnterRef.
   */
  const beginExitDisplayed = useCallback(() => {
    const current = displayedRef.current
    if (!current) {
      pendingEnterRef.current = null
      return
    }
    if (current.phase === 'out') return

    clearExitTimer()
    setDisplayed({ ...current, phase: 'out' })
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null
      const pending = pendingEnterRef.current
      pendingEnterRef.current = null
      if (pending) {
        setDisplayed({ ...pending, phase: 'in' })
      } else {
        setDisplayed(null)
      }
    }, RESULT_EXIT_MS)
  }, [clearExitTimer])

  /**
   * Update or enter a result set.
   * - Same key + already in: stream-update hits without replaying enter.
   * - Different key while old set is visible: finish exit first, then enter.
   * - No current set: enter immediately.
   */
  const showOrUpdateDisplayed = useCallback(
    (
      nextHits: GameI18nSearchHit[],
      nextSelectedId: string | null,
      key: string,
      forQuery: string,
      forLocale: GameI18nLocale,
    ) => {
      const next: DisplayedResults = {
        key,
        query: forQuery,
        searchLocale: forLocale,
        hits: nextHits,
        selectedId: nextSelectedId,
        phase: 'in',
      }

      const current = displayedRef.current

      // Same result set: just stream-update rows (no exit/enter).
      if (current && current.key === key && current.phase === 'in') {
        pendingEnterRef.current = null
        setDisplayed({
          ...current,
          hits: nextHits,
          selectedId: nextSelectedId,
        })
        return
      }

      // Already exiting a different set — keep exiting, queue the newest enter payload.
      if (current && current.phase === 'out') {
        pendingEnterRef.current = next
        return
      }

      // Visible set belongs to another query — exit first, enter after.
      if (current && current.key !== key && current.phase === 'in') {
        pendingEnterRef.current = next
        beginExitDisplayed()
        return
      }

      // Nothing on screen: enter immediately.
      clearExitTimer()
      pendingEnterRef.current = null
      setDisplayed(next)
    },
    [beginExitDisplayed, clearExitTimer],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 280)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    void loadGameI18nManifest()
      .then((manifest) => {
        if (cancelled) return
        setManifestReady(true)
        setEntryCount(manifest.locales['zh-CN']?.entryCount ?? 0)
        setError(null)
      })
      .catch(() => {
        if (cancelled) return
        setManifestReady(false)
        setError(t('manifestMissing'))
      })
    return () => {
      cancelled = true
    }
  }, [t])

  // Entering the tool page: warm ALL locale chunks (limited concurrency).
  useEffect(() => {
    if (!manifestReady) return

    prefetchAbortRef.current?.abort()
    const controller = new AbortController()
    prefetchAbortRef.current = controller
    const prefetchId = ++prefetchIdRef.current

    const applyPrefetch = (state: PrefetchState) => {
      if (prefetchId !== prefetchIdRef.current) return
      setPrefetch(state)
    }

    queueMicrotask(() => {
      if (prefetchId !== prefetchIdRef.current) return
      if (areAllGameI18nLocalesLoaded()) {
        applyPrefetch({
          loadedLocales: GAME_I18N_LOCALES.length,
          totalLocales: GAME_I18N_LOCALES.length,
          loadedBytes: 1,
          totalBytes: 1,
          readyLocales: [...GAME_I18N_LOCALES],
          activeLocale: null,
          ready: true,
        })
        return
      }

      applyPrefetch({
        loadedLocales: 0,
        totalLocales: GAME_I18N_LOCALES.length,
        loadedBytes: 0,
        totalBytes: 1,
        readyLocales: [],
        activeLocale: null,
        ready: false,
      })

      void prefetchAllGameI18nLocales({
        signal: controller.signal,
        onProgress: (progress: GameI18nAllLoadProgress) => {
          applyPrefetch({
            loadedLocales: progress.loadedLocales,
            totalLocales: progress.totalLocales,
            loadedBytes: progress.loadedBytes,
            totalBytes: progress.totalBytes,
            readyLocales: progress.readyLocales,
            activeLocale: progress.activeLocale,
            ready: progress.loadedLocales >= progress.totalLocales && progress.totalLocales > 0,
          })
        },
      })
        .then(() => {
          if (controller.signal.aborted || prefetchId !== prefetchIdRef.current) return
          setPrefetch((current) =>
            current
              ? {
                  ...current,
                  ready: true,
                  loadedLocales: current.totalLocales,
                  loadedBytes: current.totalBytes,
                  activeLocale: null,
                }
              : {
                  loadedLocales: GAME_I18N_LOCALES.length,
                  totalLocales: GAME_I18N_LOCALES.length,
                  loadedBytes: 1,
                  totalBytes: 1,
                  readyLocales: [...GAME_I18N_LOCALES],
                  activeLocale: null,
                  ready: true,
                },
          )
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || prefetchId !== prefetchIdRef.current) return
          setError(err instanceof Error ? err.message : t('searchFailed'))
          setPrefetch((current) => (current ? { ...current, ready: false } : current))
        })
    })

    return () => controller.abort()
  }, [manifestReady, t])

  // Search only after all locale files are ready. Input is allowed earlier (plan A).
  useEffect(() => {
    abortRef.current?.abort()

    if (!debouncedQuery || !manifestReady || !allLocalesReady) {
      const clearId = ++requestIdRef.current
      queueMicrotask(() => {
        if (clearId !== requestIdRef.current) return
        setHits([])
        setSearching(false)
        setResolving(false)
        setSearchProgress(null)
        setResolveProgress(null)
        if (!debouncedQuery) {
          setSettledQuery(null)
          beginExitDisplayed()
        }
      })
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestIdRef.current
    const queryForRequest = debouncedQuery
    const localeForRequest = searchLocale
    const keyForRequest = resultsKey(queryForRequest, localeForRequest)

    // Start exit of previous result set when the query/locale changes.
    const prev = displayedRef.current
    if (prev && prev.key !== keyForRequest && prev.phase === 'in') {
      beginExitDisplayed()
    }

    // Async init avoids set-state-in-effect lint; settledQuery !== debouncedQuery already
    // prevents "no results" flash until this request settles.
    queueMicrotask(() => {
      if (requestId !== requestIdRef.current) return
      setSearching(true)
      setResolving(false)
      setError(null)
      setSearchProgress({ loaded: 0, total: 1, hits: 0 })
      setResolveProgress(null)
      setHits([])
    })

    void searchGameI18n({
      searchLocale: localeForRequest,
      query: queryForRequest,
      limit: 80,
      signal: controller.signal,
      onSearchProgress: (loaded, total, hitCount) => {
        if (requestId !== requestIdRef.current) return
        setSearchProgress({ loaded, total, hits: hitCount })
        setSearching(true)
        setResolving(false)
      },
      onPartialHits: (partial) => {
        if (requestId !== requestIdRef.current) return
        setHits(partial)
        const prevSelected = displayedRef.current?.key === keyForRequest ? displayedRef.current.selectedId : null
        const nextId =
          prevSelected && partial.some((hit) => hit.textId === prevSelected)
            ? prevSelected
            : (partial[0]?.textId ?? null)
        showOrUpdateDisplayed(partial, nextId, keyForRequest, queryForRequest, localeForRequest)
        const stillPending = partial.some((hit) => (hit.pendingLocales?.length ?? 0) > 0)
        if (stillPending) {
          setResolving(true)
          setResolveProgress((current) => current ?? { done: 0, total: partial.length })
        }
      },
      onResolveProgress: (done, total) => {
        if (requestId !== requestIdRef.current) return
        setResolveProgress({ done, total })
        if (done < total) {
          setResolving(true)
          setSearching(false)
        } else {
          setResolving(false)
        }
      },
    })
      .then((results) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return
        setHits(results)
        const prevSelected = displayedRef.current?.key === keyForRequest ? displayedRef.current.selectedId : null
        const nextId =
          prevSelected && results.some((hit) => hit.textId === prevSelected)
            ? prevSelected
            : (results[0]?.textId ?? null)
        if (results.length > 0) {
          showOrUpdateDisplayed(results, nextId, keyForRequest, queryForRequest, localeForRequest)
        } else {
          beginExitDisplayed()
        }
        setSearching(false)
        setResolving(false)
        setSettledQuery(queryForRequest)
        setResolveProgress(results.length > 0 ? { done: results.length, total: results.length } : null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return
        setSearching(false)
        setResolving(false)
        setSettledQuery(queryForRequest)
        setHits([])
        beginExitDisplayed()
        setError(err instanceof Error ? err.message : t('searchFailed'))
      })

    return () => controller.abort()
  }, [debouncedQuery, searchLocale, manifestReady, allLocalesReady, t, beginExitDisplayed, showOrUpdateDisplayed])

  const busySearching = searching || searchPendingForQuery
  const renderingHits = displayed?.hits ?? []
  const renderingLocale = displayed?.searchLocale ?? searchLocale
  const renderingSelectedId = displayed?.selectedId ?? null
  const selected = renderingHits.find((hit) => hit.textId === renderingSelectedId) ?? null
  const listAnimatingOut = displayed?.phase === 'out'
  const showEmptyBody = !displayed || (displayed.phase === 'out' && renderingHits.length === 0)

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

  const statusLine = (() => {
    if (allLocalesLoading && prefetch) {
      const active = prefetch.activeLocale ? localeLabel(prefetch.activeLocale) : ''
      return (
        <span className="inline-flex items-center gap-1">
          <LoaderCircle className="size-3.5 animate-spin" />
          {t('loadingAllTranslations', {
            loaded: prefetch.loadedLocales,
            total: prefetch.totalLocales,
            percent: loadPercent,
            locale: active || t('localeGeneric'),
          })}
        </span>
      )
    }
    if (busySearching) {
      return (
        <span className="inline-flex items-center gap-1">
          <LoaderCircle className="size-3.5 animate-spin" />
          {searchProgress
            ? t('searchProgress', {
                loaded: searchProgress.loaded.toLocaleString(),
                total: searchProgress.total.toLocaleString(),
                hits: searchProgress.hits,
                percent: percentOf(searchProgress.loaded, searchProgress.total),
              })
            : t('searching')}
        </span>
      )
    }
    if (resolving) {
      return (
        <span className="inline-flex items-center gap-1">
          <LoaderCircle className="size-3.5 animate-spin" />
          {resolveProgress
            ? t('resolvingProgress', { done: resolveProgress.done, total: resolveProgress.total })
            : t('resolving')}
        </span>
      )
    }
    if (debouncedQuery && allLocalesReady && hits.length > 0 && settledQuery === debouncedQuery) {
      return <span>{t('resultCount', { count: hits.length })}</span>
    }
    if (showNoResults) {
      return <span>{t('noResults')}</span>
    }
    if (allLocalesReady && !debouncedQuery) {
      return <span>{t('allLocalesReady')}</span>
    }
    return null
  })()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
      <div className="shrink-0 space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid w-full gap-1.5 sm:w-auto sm:min-w-[10rem]">
            <Label htmlFor="game-i18n-locale" className="whitespace-normal leading-snug">
              {t('searchLocale')}
            </Label>
            <Select value={searchLocale} onValueChange={(value) => value && setSearchLocale(value as GameI18nLocale)}>
              <SelectTrigger id="game-i18n-locale" className="w-full sm:w-[12rem]">
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
          <div className="grid min-w-0 w-full flex-1 gap-1.5">
            <Label htmlFor="game-i18n-query" className="whitespace-normal leading-snug">
              {t('query')}
            </Label>
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="game-i18n-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('queryPlaceholder')}
                className="min-w-0 pl-9"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {manifestReady ? <span>{t('entryCount', { count: entryCount.toLocaleString() })}</span> : null}
          {statusLine}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-h-0 overflow-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[12rem]">{t('textId')}</TableHead>
                <TableHead>{t('matchedText')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showEmptyBody || renderingHits.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={2} className="p-0 whitespace-normal">
                    <div className="flex min-h-[12rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      {allLocalesLoading && prefetch ? (
                        <span className="inline-flex items-center gap-2">
                          <LoaderCircle className="size-4 animate-spin" />
                          {t('loadingAllTranslationsHint', {
                            loaded: prefetch.loadedLocales,
                            total: prefetch.totalLocales,
                            percent: loadPercent,
                          })}
                        </span>
                      ) : busySearching || resolving || listAnimatingOut ? (
                        <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
                      ) : showNoResults ? (
                        t('noResults')
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                renderingHits.map((hit, index) => {
                  const preview = hit.texts[renderingLocale] ?? Object.values(hit.texts)[0] ?? ''
                  const active = hit.textId === renderingSelectedId
                  const pending = (hit.pendingLocales?.length ?? 0) > 0
                  return (
                    <TableRow
                      key={`${displayed?.key ?? 'hit'}:${hit.textId}`}
                      className={cn(
                        'cursor-pointer',
                        active && 'bg-muted/50',
                        listAnimatingOut
                          ? 'animate-out fade-out slide-out-to-top-1 fill-mode-forwards duration-200'
                          : 'animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200',
                      )}
                      style={
                        listAnimatingOut
                          ? undefined
                          : { animationDelay: `${Math.min(index, 10) * 16}ms` }
                      }
                      onClick={() => {
                        if (listAnimatingOut) return
                        setDisplayed((current) =>
                          current ? { ...current, selectedId: hit.textId } : current,
                        )
                      }}
                    >
                      <TableCell className="w-[12rem] font-mono text-xs break-all whitespace-normal">
                        {hit.textId}
                      </TableCell>
                      <TableCell className="max-w-0 truncate text-sm whitespace-nowrap">
                        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate">{preview}</span>
                          {pending ? (
                            <LoaderCircle className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                          ) : null}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="min-h-0 overflow-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
          {selected && displayed ? (
            <div
              key={`detail:${displayed.key}:${selected.textId}:${listAnimatingOut ? 'out' : 'in'}`}
              className={cn(
                'space-y-4 p-4',
                listAnimatingOut
                  ? 'animate-out fade-out slide-out-to-top-1 fill-mode-forwards duration-200'
                  : 'animate-in fade-in slide-in-from-bottom-1 duration-200',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t('textId')}</Badge>
                <code className="font-mono text-xs break-all">{selected.textId}</code>
                <Button type="button" size="sm" variant="outline" onClick={copyTextId}>
                  <Copy className="size-3.5" />
                  {copied ? t('copied') : t('copyId')}
                </Button>
                {resolving || (selected.pendingLocales?.length ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <LoaderCircle className="size-3.5 animate-spin" />
                    {resolveProgress
                      ? t('resolvingProgress', { done: resolveProgress.done, total: resolveProgress.total })
                      : t('resolving')}
                  </span>
                ) : null}
              </div>
              <div className="space-y-3">
                {GAME_I18N_LOCALES.map((locale) => {
                  const pending = selected.pendingLocales?.includes(locale) ?? false
                  const value = selected.texts[locale]
                  return (
                    <div key={locale} className="rounded-lg bg-muted/35 p-3">
                      <div className="text-xs font-medium text-muted-foreground">{localeLabel(locale)}</div>
                      <p className="mt-1 whitespace-pre-wrap text-sm break-words">
                        {pending ? (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <LoaderCircle className="size-3.5 animate-spin" />
                            {t('localeLoading')}
                          </span>
                        ) : value !== undefined ? (
                          value
                        ) : (
                          t('missingTranslation')
                        )}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'flex min-h-[12rem] items-center justify-center p-6 text-center text-sm text-muted-foreground',
                'animate-in fade-in duration-200',
              )}
            >
              {t('detailEmpty')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
