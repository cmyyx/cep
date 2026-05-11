'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useVersion } from '@/hooks/use-version'
import { formatTime } from '@/lib/utils'
import { MIN_LOADING_DISPLAY_MS } from '@/lib/constants'
import { RefreshCw, ArrowRight } from 'lucide-react'
import type { VersionInfo } from '@/types/version'

interface ChangelogResponse {
  changelog: string[]
}

function parseChangelogEntry(entry: string) {
  const firstNewline = entry.indexOf('\n')
  const firstLine = firstNewline === -1 ? entry : entry.slice(0, firstNewline)
  const body = firstNewline === -1 ? '' : entry.slice(firstNewline + 1).trim()

  const firstSpace = firstLine.indexOf(' ')
  const hash = firstSpace === -1 ? '' : firstLine.slice(0, firstSpace)
  const time = firstSpace === -1 ? '' : firstLine.slice(firstSpace + 1)

  return { hash, time, body }
}

function VersionCard({ label, info }: { label: string; info: VersionInfo }) {
  const t = useTranslations()

  return (
    <div className="flex-1 rounded-lg shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)] p-4">
      <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide text-center">{label}</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('version.version')}</span>
          <span className="text-sm font-mono font-medium">{info.version}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('version.commit')}</span>
          <span className="text-sm font-mono">{info.commit}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('version.commitCount')}</span>
          <span className="text-sm font-mono">{info.count}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('version.commitTime')}</span>
          <span className="text-sm font-mono">{formatTime(info.commitTime)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('version.buildTime')}</span>
          <span className="text-sm font-mono">{formatTime(info.buildTime)}</span>
        </div>
      </div>
    </div>
  )
}

export default function UpdatePage() {
  const t = useTranslations()
  const { info, localInfo, isUpdateAvailable, checkNow, refreshPage } = useVersion()
  const [changelog, setChangelog] = useState<string[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const startedAt = Date.now()

    let didError = false
    let changelogData: string[] = []

    fetch('/changelog.json', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch changelog')
        return res.json() as Promise<ChangelogResponse>
      })
      .then((data) => {
        if (controller.signal.aborted) return
        changelogData = Array.isArray(data.changelog) ? data.changelog : []
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        didError = true
      })
      .finally(async () => {
        if (controller.signal.aborted) return
        // Enforce minimum skeleton display time so skeleton doesn't flash
        const elapsed = Date.now() - startedAt
        if (elapsed < MIN_LOADING_DISPLAY_MS) {
          const delay = MIN_LOADING_DISPLAY_MS - elapsed
          await new Promise<void>((resolve) => {
            const id = setTimeout(resolve, delay)
            const onAbort = () => {
              clearTimeout(id)
              resolve()
            }
            controller.signal.addEventListener('abort', onAbort, { once: true })
          })
        }
        if (!controller.signal.aborted) {
          setChangelog(didError ? null : changelogData)
          setIsLoading(false)
          setLoadError(didError)
        }
      })

    return () => {
      controller.abort()
    }
  }, [])

  // Sequential animation: skeleton exit → content enter.
  // Effects watch isLoading and transition the animation phase.
  const skeletonShown = useRef(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [animPhase, setAnimPhase] = useState<'skeleton' | 'exiting' | 'content'>('skeleton')

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isLoading) {
      skeletonShown.current = true
      setAnimPhase('skeleton')
    }
  }, [isLoading])

  useEffect(() => {
    if (!isLoading && animPhase === 'skeleton') {
      if (skeletonShown.current) {
        setAnimPhase('exiting')
        // Fallback: if onAnimationEnd doesn't fire (e.g. animation interrupted),
        // force transition to content after duration-200 + 50ms buffer
        exitTimerRef.current = setTimeout(() => {
          setAnimPhase('content')
          exitTimerRef.current = null
        }, 250)
      } else {
        setAnimPhase('content')
      }
    }
    return () => {
      if (exitTimerRef.current !== null) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
    }
  }, [isLoading, animPhase])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSkeletonExitEnd = useCallback(() => {
    if (exitTimerRef.current !== null) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
    setAnimPhase('content')
  }, [])

  const displayInfo = localInfo ?? info

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-3rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('nav.update')}
        </h1>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-scroll p-8 flex items-start justify-center">
        <div className="w-full max-w-lg">
          {/* Version comparison */}
          {isUpdateAvailable && localInfo && info ? (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <VersionCard label={t('version.local')} info={localInfo} />
                <ArrowRight className="size-5 text-muted-foreground shrink-0" />
                <VersionCard label={t('version.remote')} info={info} />
              </div>
              <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950 p-3">
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {t('version.updateAvailable')}
                </span>
              </div>
            </div>
          ) : (
            displayInfo && (
              <div className="mb-6">
                <VersionCard label={t('version.local')} info={displayInfo} />
              </div>
            )
          )}

          {/* Action buttons — above changelog */}
          <div className="flex gap-2 mb-6">
            <Button variant="outline" onClick={checkNow} className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('version.checkUpdate')}
            </Button>
            {isUpdateAvailable && (
              <Button onClick={refreshPage} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('version.clickToRefresh')}
              </Button>
            )}
          </div>

          {/* Changelog */}
          <div className="rounded-lg shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)] p-4">
            <h3 className="text-sm font-semibold mb-3">{t('version.commitMessage')}</h3>
            {animPhase !== 'content' ? (
              /* Skeleton — fades out via animate-out before content mounts */
              <div
                className={
                  animPhase === 'exiting'
                    ? 'min-h-[136px] space-y-3 animate-out fade-out duration-200'
                    : 'min-h-[136px] space-y-3'
                }
                onAnimationEnd={animPhase === 'exiting' ? handleSkeletonExitEnd : undefined}
              >
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full" />
              </div>
            ) : loadError ? (
              /* Error — appears with fade-in after skeleton exits */
              <div className="min-h-[136px] flex items-center justify-center text-center text-sm text-muted-foreground animate-in fade-in duration-200">
                {t('version.changelogError')}
              </div>
            ) : (
              /* Success — appears with fade-in after skeleton exits */
              <ul className="animate-in fade-in duration-200 space-y-3">
                {(changelog ?? []).map((entry, index) => {
                  const { hash, time, body } =
                    parseChangelogEntry(entry)
                  return (
                    <li key={hash || index} className="text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        {hash && (
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {hash}
                          </span>
                        )}
                        {time && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(time)}
                          </span>
                        )}
                      </div>
                      {body && (
                        <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                          {body}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
