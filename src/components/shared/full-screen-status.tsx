import type { ComponentProps, ReactNode } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface FullScreenStatusProps extends Omit<ComponentProps<'div'>, 'title'> {
  heading: ReactNode
  description?: ReactNode
  indicator?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  tone?: 'default' | 'destructive'
  animateIcon?: boolean
}

export function FullScreenStatus({
  heading,
  description,
  indicator,
  actions,
  footer,
  tone = 'default',
  animateIcon = false,
  className,
  ...props
}: FullScreenStatusProps) {
  const destructive = tone === 'destructive'

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-background px-5 py-8 text-foreground',
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 pointer-events-none bg-engineering-grid" />
      {destructive ? (
        <div className="absolute left-1/2 top-1/3 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ship-red/10 blur-3xl" />
      ) : null}

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-6 text-center">
        <div className={cn('relative flex size-14 items-center justify-center', animateIcon && 'animate-[icon-pulse_2s_ease-in-out_infinite]')}>
          <Image src="/icon.svg" alt="" width={56} height={56} className="size-14" unoptimized priority />
          <div className={cn(
            'absolute inset-0 -z-10 scale-125 rounded-full blur-xl',
            destructive ? 'bg-ship-red/20' : 'bg-develop-blue/10',
            animateIcon && 'animate-[icon-glow_2s_ease-in-out_infinite]',
          )} />
        </div>

        <div className="space-y-1">
          <h1 className="select-none font-mono text-[48px] font-semibold tracking-[-2.88px]">CEP</h1>
          <h2 className={cn('text-sm font-medium tracking-[-0.32px]', destructive ? 'text-ship-red' : 'text-muted-foreground')}>
            {heading}
          </h2>
        </div>

        {description ? <div className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</div> : null}
        {indicator}
        {actions ? <div className="flex w-full max-w-sm flex-col gap-2">{actions}</div> : null}
        {footer}
      </div>
    </div>
  )
}

export default FullScreenStatus
