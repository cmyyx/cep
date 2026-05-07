'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import type { VersionInfo } from '@/types/version'

const POLL_INTERVAL = 5 * 60 * 1000
const FOCUS_CD = 30 * 1000

interface VersionContextType {
  info: VersionInfo | null
  localInfo: VersionInfo | null
  isUpdateAvailable: boolean
  checkNow: () => void
  refreshPage: () => void
}

const VersionContext = createContext<VersionContextType | null>(null)

export function VersionProvider({ children, initialInfo }: { children: ReactNode, initialInfo?: VersionInfo }) {
  const [info, setInfo] = useState<VersionInfo | null>(initialInfo ?? null)
  const [localInfo] = useState<VersionInfo | null>(() => initialInfo ?? null)
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false)
  const initialCommit = useRef<string | null>(initialInfo?.commit || null)
  const lastFocusCheck = useRef(0)

  const fetchVersion = useCallback(async () => {
    if (typeof window === 'undefined') return
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const data: VersionInfo = await res.json()
      setInfo(data)
      if (initialCommit.current === null) {
        initialCommit.current = data.commit
      } else if (initialCommit.current !== data.commit) {
        setIsUpdateAvailable(true)
      } else {
        setIsUpdateAvailable(false)
      }
    } catch {
      // 网络异常，静默处理
    }
  }, [])

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
    <VersionContext.Provider value={{ info, localInfo, isUpdateAvailable, checkNow, refreshPage }}>
      {children}
    </VersionContext.Provider>
  )
}

export function useVersion() {
  const ctx = useContext(VersionContext)
  if (!ctx) throw new Error('useVersion must be used within VersionProvider')
  return ctx
}
