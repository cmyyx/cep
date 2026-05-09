'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import type { VersionInfo } from '@/types/version'
import { useAppInitStore } from '@/stores/useAppInitStore'

const POLL_INTERVAL = 5 * 60 * 1000
const FOCUS_CD = 30 * 1000

interface VersionContextType {
  info: VersionInfo | null
  localInfo: VersionInfo | null
  isUpdateAvailable: boolean
  forceUpgrade: boolean
  checkNow: () => void
  refreshPage: () => void
}

const VersionContext = createContext<VersionContextType | null>(null)

export function VersionProvider({ children, initialInfo }: { children: ReactNode, initialInfo?: VersionInfo }) {
  const [info, setInfo] = useState<VersionInfo | null>(initialInfo ?? null)
  const [localInfo] = useState<VersionInfo | null>(() => initialInfo ?? null)
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false)
  const [forceUpgrade, setForceUpgrade] = useState(false)
  const initialCommit = useRef<string | null>(initialInfo?.commit || null)
  const lastFocusCheck = useRef(0)
  const consecutiveFailures = useRef(0)

  const fetchVersion = useCallback(async () => {
    if (typeof window === 'undefined') return

    const initStore = useAppInitStore.getState()
    const isFirstFetch = initStore.phase === 'tracking' && !initStore.completedTasks.has('version')
    if (isFirstFetch) {
      initStore.registerTask('version')
    }

    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const data: VersionInfo = await res.json()
      setInfo(data)
      consecutiveFailures.current = 0

      if (initialCommit.current === null) {
        initialCommit.current = data.commit
        return
      }

      if (initialCommit.current === data.commit) {
        setIsUpdateAvailable(false)
        setForceUpgrade(false)
        return
      }

      // 远程 commit 与本地不同，用 commitTime 判断是更新还是回退
      const localTime = localInfo?.commitTime ?? ''
      if (localTime && data.commitTime <= localTime) {
        // 远程版本不新于本地 → 回退或相同，不视为更新
        setIsUpdateAvailable(false)
        setForceUpgrade(false)
        return
      }

      // 确认是新版本
      setIsUpdateAvailable(true)
      if (data.forceUpgradeSerial !== (localInfo?.forceUpgradeSerial ?? 0)) {
        setForceUpgrade(true)
      }
    } catch {
      consecutiveFailures.current++
      // 单次网络异常保持当前状态不重置，防止短暂断网误清除通知
      // 连续 3 次失败才认为持续不可用，重置状态
      if (consecutiveFailures.current >= 3) {
        setIsUpdateAvailable(false)
        setForceUpgrade(false)
      }
    } finally {
      if (isFirstFetch) {
        // Signal completion after a brief animation grace period so the
        // progress bar doesn't snap from loading → finalising instantly
        setTimeout(() => {
          useAppInitStore.getState().completeTask('version')
        }, 300)
      }
    }
  }, [localInfo])

  const checkNow = useCallback(() => { fetchVersion() }, [fetchVersion])
  const refreshPage = useCallback(() => { window.location.reload() }, [])

  useEffect(() => {
    // 首次加载 + 定时轮询 + 获焦检测
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVersion()

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchVersion()
    }, POLL_INTERVAL)

    const handleFocus = () => {
      const now = Date.now()
      if (now - lastFocusCheck.current < FOCUS_CD) return
      lastFocusCheck.current = now
      fetchVersion()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleFocus()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchVersion])

  return (
    <VersionContext.Provider value={{ info, localInfo, isUpdateAvailable, forceUpgrade, checkNow, refreshPage }}>
      {children}
    </VersionContext.Provider>
  )
}

export function useVersion() {
  const ctx = useContext(VersionContext)
  if (!ctx) throw new Error('useVersion must be used within VersionProvider')
  return ctx
}
