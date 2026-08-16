'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export interface DeleteConfirmButtonProps {
  disabled: boolean
  onConfirm: () => void
}

/**
 * Delete-confirm button with a 3s cooldown: locked with a visible countdown
 * right after the dialog opens, so a double-click can never nuke an account.
 * The parent remounts this component (via key) whenever the dialog opens,
 * which resets the countdown.
 */
export function DeleteConfirmButton({ disabled, onConfirm }: DeleteConfirmButtonProps) {
  const t = useTranslations()
  const [seconds, setSeconds] = useState(3)

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((value) => (value <= 1 ? 0 : value - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <Button type="button" variant="destructive" size="sm" disabled={disabled || seconds > 0} onClick={onConfirm}>
      {seconds > 0 ? `${t('essence.accountDelete')} (${seconds}s)` : t('essence.accountDelete')}
    </Button>
  )
}
