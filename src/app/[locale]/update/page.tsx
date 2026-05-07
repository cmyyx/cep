'use client'

import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useVersion } from '@/hooks/use-version'
import { formatTime } from '@/lib/utils'
import { RefreshCw, Download, CheckCircle2 } from 'lucide-react'

export default function UpdatePage() {
  const t = useTranslations()
  const { info, localInfo, isUpdateAvailable, checkNow, refreshPage } = useVersion()

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
      <div className="flex flex-1 items-start justify-center p-8">
        <div className="w-full max-w-md">
          {/* 当前版本 */}
          <div className="flex items-center justify-between py-4 border-b border-border">
            <span className="text-sm text-muted-foreground">{t('version.version')}</span>
            <span className="text-sm font-mono font-medium">{displayInfo?.version ?? t('version.unknown')}</span>
          </div>

          {/* 构建信息 */}
          {displayInfo && (
            <div className="py-4">
              <div className="rounded-lg border border-border p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{t('version.commit')}</span>
                  <span className="text-sm font-mono">{displayInfo.commit}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('version.commitTime')}</span>
                  <span className="text-sm font-mono">{formatTime(displayInfo.commitTime)}</span>
                </div>
              </div>

              {/* 更新日志 */}
              {displayInfo.changelog && displayInfo.changelog.length > 0 && (
                <div className="rounded-lg border border-border p-4 mb-4">
                  <h3 className="text-sm font-semibold mb-3">{t('version.commitMessage')}</h3>
                  <ul className="space-y-2">
                    {displayInfo.changelog.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 更新状态 */}
              {isUpdateAvailable ? (
                <div className="rounded-lg border border-primary/50 bg-primary/5 p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    <span className="text-sm font-semibold text-primary">
                      {t('version.updateAvailable')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-2 mb-4">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">
                    {t('version.version')} {displayInfo.version}
                  </span>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-2">
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
