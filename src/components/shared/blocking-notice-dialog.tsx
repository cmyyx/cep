'use client'

import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface BlockingNoticeDialogProps {
  title: string
  description: ReactNode
  children?: ReactNode
}

export function BlockingNoticeDialog({ title, description, children }: BlockingNoticeDialogProps) {
  return (
    <Dialog open modal disablePointerDismissal>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children ? <DialogFooter className="flex-col sm:flex-col">{children}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}

export default BlockingNoticeDialog
