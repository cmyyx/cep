'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useAppInitStore } from '@/stores/useAppInitStore'
import { cn } from '@/lib/utils'

const PHASE_LABEL: Record<string, string> = {
  splash: '',
  tracking: 'LOADING MODULES',
  ready: 'READY',
}

/**
 * Full-viewport cinematic loading overlay.
 *
 * Renders from the very first server-side HTML frame — no `mounted` gate.
 * Content behind the overlay is invisible until it fades out, so layout
 * shifts (announcement banner, etc.) happen unseen.
 *
 * Progress tracking:
 *   0% → 60%   Simulated hydration (requestAnimationFrame, ease-out cubic)
 *  60% → 90%   Real data loading (byte-level fetch progress + task milestones)
 *  90% → 100%  Finalising (triggered when all tasks complete)
 * 100%          Flash → fade out → markCompleted
 */
export function AppInitOverlay() {
  const phase = useAppInitStore((s) => s.phase)
  const progress = useAppInitStore((s) => s.progress)
  const hasCompleted = useAppInitStore((s) => s.hasCompleted)
  const markReady = useAppInitStore((s) => s.markReady)
  const markCompleted = useAppInitStore((s) => s.markCompleted)
  const beginTracking = useAppInitStore((s) => s.beginTracking)
  const setProgress = useAppInitStore((s) => s.setProgress)
  const tasks = useAppInitStore((s) => s.tasks)
  const completedTasks = useAppInitStore((s) => s.completedTasks)

  // Exit animation state — driven by CSS transition, no layout impact
  const [exitPhase, setExitPhase] = useState<'none' | 'exiting'>('none')

  // Kick off tracking (hydration simulation + data task registration).
  // This must run after mount because it uses requestAnimationFrame.
  useEffect(() => {
    if (hasCompleted) return
    beginTracking()
  }, [hasCompleted, beginTracking])

  // ── Hydration simulation: 0% → 60% over ~800ms (ease-out cubic) ──
  useEffect(() => {
    if (phase !== 'tracking') return

    const start = Date.now()
    const duration = 800
    const startVal = progress

    const tick = () => {
      const elapsed = Date.now() - start
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(startVal + (60 - startVal) * eased)

      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        setProgress(60)
      }
    }

    const frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── When all tasks complete → finalise ──
  const allTasksDone = tasks.size > 0 && [...tasks].every((t) => completedTasks.has(t))
  useEffect(() => {
    if (phase === 'tracking' && allTasksDone) {
      setProgress(90)
      const timer = setTimeout(() => {
        markReady()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [phase, allTasksDone, setProgress, markReady])

  // ── Ready → exit sequence (opacity fade out → markCompleted) ──
  useEffect(() => {
    if (phase !== 'ready') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExitPhase('exiting')
    // After the opacity transition (duration-400), mark permanently done
    const timer = setTimeout(() => {
      markCompleted()
    }, 450)
    return () => clearTimeout(timer)
  }, [phase, markCompleted])

  // ── Never show again after first completion ──
  if (hasCompleted) return null

  const phaseLabel = PHASE_LABEL[phase] ?? ''
  // Show progress bar during tracking AND ready phases (and a simplified
  // 0% bar during splash so it's visible from the first frame)
  const showProgress = phase === 'splash' || phase === 'tracking' || phase === 'ready'
  const displayProgress = Math.min(100, Math.max(0, phase === 'ready' ? 100 : progress))
  const glowColor =
    displayProgress < 40
      ? 'rgba(10,114,239,0.35)'
      : displayProgress < 70
        ? 'rgba(222,29,141,0.35)'
        : 'rgba(255,91,79,0.35)'

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background',
        'transition-opacity duration-400 ease-out',
        exitPhase === 'exiting' && 'opacity-0 pointer-events-none'
      )}
      aria-hidden={exitPhase === 'exiting'}
    >
      {/* ── Engineering grid background ── */}
      <div
        className="absolute inset-0 pointer-events-none animate-[grid-drift_20s_linear_infinite]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(128,128,128,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(128,128,128,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── Content ── */}
      <div className="relative flex flex-col items-center gap-7 z-10">
        {/* Icon with breathing pulse */}
        <div className="animate-[icon-pulse_2s_ease-in-out_infinite] size-14 flex items-center justify-center">
          <div className="relative size-14">
            <Image
              src="/icon.svg"
              alt=""
              width={56}
              height={56}
              className="size-14"
              unoptimized
              priority
            />
            <div className="absolute inset-0 -z-10 rounded-full bg-develop-blue/10 blur-xl scale-125 animate-[icon-glow_2s_ease-in-out_infinite]" />
          </div>
        </div>

        {/* Brand title with glitch converge */}
        <h1
          className="text-[48px] font-semibold font-mono tracking-[-2.88px] text-foreground select-none animate-[glitch-converge_1.2s_cubic-bezier(0.16,1,0.3,1)_forwards]"
          style={{ fontFamily: 'var(--font-geist-mono)' } as React.CSSProperties}
        >
          CEP
        </h1>

        {/* Subtitle */}
        <p className="text-sm text-muted-foreground tracking-[-0.32px] font-medium -mt-5 select-none">
          终末地规划器
        </p>

        {/* ── Progress bar ── */}
        <div
          className={cn(
            'w-[280px] transition-all duration-500 ease-out',
            showProgress ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}
        >
          <div className="relative h-[3px] w-full bg-muted rounded-full overflow-hidden">
            {/* Fill bar */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-develop-blue via-preview-pink to-ship-red rounded-full"
              style={{
                width: `${displayProgress}%`,
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: displayProgress > 0 ? `0 0 10px ${glowColor}` : 'none',
              }}
            >
              {/* Shimmer sweep */}
              <div
                className="absolute inset-0 animate-[progress-shimmer_1.8s_ease-in-out_infinite]"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 30%, rgba(255,255,255,0.5) 70%, transparent 100%)',
                }}
              />
            </div>

            {/* Leading dot */}
            {displayProgress > 0 && displayProgress < 100 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 size-[5px] rounded-full bg-white shadow-[0_0_8px_rgba(10,114,239,0.7)] animate-[dot-pulse_1.5s_ease-in-out_infinite]"
                style={{
                  left: `calc(${displayProgress}% - 2.5px)`,
                  transition: 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            )}
          </div>

          {phaseLabel && (
            <p className="mt-3 text-center font-mono text-[11px] tracking-[0.2em] text-muted-foreground/60 uppercase select-none">
              {phaseLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
