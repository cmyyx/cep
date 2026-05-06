'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSidebar } from '@/components/ui/sidebar'
import { useVersion } from '@/hooks/use-version'
import { VersionDialog } from './version-dialog'
import { formatTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function VersionBadge() {
  const t = useTranslations('version')
  const { info, isUpdateAvailable, refreshPage } = useVersion()
  const [dialogOpen, setDialogOpen] = useState(false)
  const { state } = useSidebar()

  if (!info) return null

  return (
    <>
      <div className="flex w-full min-w-0 flex-col gap-0">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={refreshPage}
                className={cn(
                  'flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm transition-[width,height,padding] duration-200 ease-linear',
                  'group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! group-data-[collapsible=icon]:justify-center',
                  isUpdateAvailable
                    ? 'text-blue-600 dark:text-blue-400 hover:bg-accent'
                    : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent hidden group-data-[collapsible=icon]:flex'
                )}
              >
                <RefreshCw className="size-4 shrink-0" />
                <span className="truncate text-xs font-medium transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:hidden">
                  {t('updateAvailable')} · {t('clickToRefresh')}
                </span>
              </button>
            }
          />
          <TooltipContent side="right" hidden={state !== 'collapsed'}>
            {isUpdateAvailable
              ? `${t('updateAvailable')} · ${t('clickToRefresh')}`
              : t('checkUpdate')}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className={cn(
                  'flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm transition-[width,height,padding] duration-200 ease-linear',
                  'group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! group-data-[collapsible=icon]:justify-center',
                  'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Info className="size-4 shrink-0" />
                <span className="flex w-full min-w-0 flex-col gap-0 overflow-hidden transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:hidden">
                  <span className="flex items-center gap-1 truncate text-xs">
                    <span className="font-mono">{info.commit}</span>
                    <span>{formatTime(info.buildTime)}</span>
                  </span>
                  <span className="truncate text-[10px] leading-tight opacity-70 ml-4">
                    {info.message}
                  </span>
                </span>
              </button>
            }
          />
          <TooltipContent side="right" hidden={state !== 'collapsed'}>
            {t('label')}
          </TooltipContent>
        </Tooltip>
      </div>
      <VersionDialog info={info} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
