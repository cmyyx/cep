'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { clampAccountName, MAX_ACCOUNTS } from '@/lib/essence-accounts'

type DialogKind = 'create' | 'rename' | 'delete' | 'limit' | null

/**
 * Game-account switcher for the essence planner.
 *
 * Each game account owns its marks (weapon/essence ownership + notes);
 * switching re-mirrors the active account's data into the store's flat
 * fields, which every existing component reads.
 */
export function AccountSwitcher() {
  const t = useTranslations()
  const accounts = useEssenceSettingsStore((s) => s.accounts)
  const activeAccountId = useEssenceSettingsStore((s) => s.activeAccountId)
  const addAccount = useEssenceSettingsStore((s) => s.addAccount)
  const renameAccount = useEssenceSettingsStore((s) => s.renameAccount)
  const removeAccount = useEssenceSettingsStore((s) => s.removeAccount)
  const setActiveAccount = useEssenceSettingsStore((s) => s.setActiveAccount)

  const [dialogKind, setDialogKind] = useState<DialogKind>(null)
  const [nameInput, setNameInput] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)
  const [deleteEpoch, setDeleteEpoch] = useState(0)
  const active = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? accounts[0],
    [accounts, activeAccountId],
  )
  const target = useMemo(
    () => accounts.find((account) => account.id === targetId) ?? null,
    [accounts, targetId],
  )

  const openCreate = () => {
    setNameInput(t('essence.accountDefaultName', { n: accounts.length + 1 }))
    setTargetId(null)
    setDialogKind('create')
  }
  const openRename = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId)
    setNameInput(account?.name ?? '')
    setTargetId(accountId)
    setDialogKind('rename')
  }
  const openDelete = (accountId: string) => {
    setTargetId(accountId)
    setDeleteEpoch((epoch) => epoch + 1)
    setDialogKind('delete')
  }

  const confirmCreate = () => {
    addAccount(clampAccountName(nameInput.trim() || t('essence.accountDefaultName', { n: accounts.length + 1 })))
    setDialogKind(null)
  }
  const confirmRename = () => {
    if (targetId) renameAccount(targetId, clampAccountName(nameInput.trim()))
    setDialogKind(null)
  }
  const confirmDelete = () => {
    if (targetId) removeAccount(targetId)
    setDialogKind(null)
  }

  const canAdd = accounts.length < MAX_ACCOUNTS
  const canDelete = accounts.length > 1

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="max-w-32 gap-1.5 px-2" aria-label={t('essence.accountSwitcher')} />}>
          <UserRound className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{active?.name || '—'}</span>
        </DropdownMenuTrigger>
        {/* align="start": the menu's left edge follows the trigger's left edge,
            which is layout-stable — with align="end" the right edge tracked the
            trigger width, so the menu slid left/right as account names changed. */}
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('essence.accountSwitcher')}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuGroup>
            {accounts.map((account) => (
              <DropdownMenuItem key={account.id} onClick={() => setActiveAccount(account.id)}>
                <span className="min-w-0 flex-1 truncate">{account.name || '—'}</span>
                {account.id === activeAccountId ? <Check className="size-4 shrink-0" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {/* Keep the item clickable at the cap so users learn WHY it is
              unavailable — a silently disabled item hides the 10-account limit. */}
          <DropdownMenuItem onClick={() => (canAdd ? openCreate() : setDialogKind('limit'))}>
            <Plus className="size-4" />
            {t('essence.accountNew')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openRename(activeAccountId)}>
            <Pencil className="size-4" />
            {t('essence.accountRename')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canDelete} onClick={() => openDelete(activeAccountId)}>
            <Trash2 className="size-4" />
            {t('essence.accountDelete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create */}
      <Dialog open={dialogKind === 'create'} onOpenChange={(open) => { if (!open) setDialogKind(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('essence.accountNew')}</DialogTitle>
            <DialogDescription>{t('essence.accountNewDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="account-name-create">{t('essence.accountNameLabel')}</Label>
            <Input
              id="account-name-create"
              value={nameInput}
              maxLength={50}
              onChange={(event) => setNameInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') confirmCreate() }}
              placeholder={t('essence.accountNamePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogKind(null)}>{t('essence.cancel')}</Button>
            <Button type="button" size="sm" onClick={confirmCreate}>{t('essence.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={dialogKind === 'rename'} onOpenChange={(open) => { if (!open) setDialogKind(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('essence.accountRename')}</DialogTitle>
            <DialogDescription>{t('essence.accountRenameDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="account-name-rename">{t('essence.accountNameLabel')}</Label>
            <Input
              id="account-name-rename"
              value={nameInput}
              maxLength={50}
              onChange={(event) => setNameInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') confirmRename() }}
              placeholder={t('essence.accountNamePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogKind(null)}>{t('essence.cancel')}</Button>
            <Button type="button" size="sm" onClick={confirmRename}>{t('essence.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={dialogKind === 'delete'} onOpenChange={(open) => { if (!open) setDialogKind(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t('essence.accountDelete')}</DialogTitle>
            <DialogDescription>
              {canDelete
                ? t('essence.accountDeleteConfirm', { name: target?.name || '—' })
                : t('essence.accountCannotDeleteLast')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogKind(null)}>{t('essence.cancel')}</Button>
            {/* keyed remount resets the 3s cooldown every time the dialog opens */}
            <DeleteConfirmButton key={`${dialogKind === 'delete' ? targetId ?? '' : 'closed'}-${deleteEpoch}`} disabled={!canDelete} onConfirm={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account cap reached */}
      <Dialog open={dialogKind === 'limit'} onOpenChange={(open) => { if (!open) setDialogKind(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('essence.accountSwitcher')}</DialogTitle>
            <DialogDescription>{t('essence.accountMaxReached', { count: MAX_ACCOUNTS })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" size="sm" onClick={() => setDialogKind(null)}>{t('essence.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Delete-confirm button with a 3s cooldown: locked with a visible countdown
 * right after the dialog opens, so a double-click can never nuke an account.
 * The parent remounts this component (via key) whenever the dialog opens,
 * which resets the countdown.
 */
function DeleteConfirmButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
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
