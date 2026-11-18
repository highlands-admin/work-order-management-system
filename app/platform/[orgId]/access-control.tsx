'use client'

import { useState, useTransition } from 'react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

import { platformSetSuspendedAction } from '../actions'

// Pauses or resumes the organization. Pausing is reversible and keeps every
// record, so a confirmation is enough; nothing is deleted.
export function AccessControl({
  organizationId,
  organizationName,
  suspended,
  isOwn,
}: {
  organizationId: string
  organizationName: string
  suspended: boolean
  isOwn: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function apply(next: boolean) {
    setError(null)
    startTransition(async () => {
      const message = await platformSetSuspendedAction(organizationId, next)
      if (message) setError(message)
      setOpen(false)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <div>
          <p className="font-medium">
            {suspended ? 'Access is paused' : 'Access is on'}
          </p>
          <p className="text-sm text-muted-foreground">
            {suspended
              ? 'Members see a paused notice. No alerts or recurring work orders go out.'
              : 'Members can sign in and use Workflow 360.'}
          </p>
        </div>

        {suspended ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => apply(false)}
          >
            {pending ? 'Resuming...' : 'Resume access'}
          </Button>
        ) : (
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isOwn}
                  className="text-destructive"
                />
              }
            >
              Pause access
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Pause {organizationName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Everyone in {organizationName} is signed out and sees a paused
                notice until you resume. Pending invitations are cancelled, and
                reminder emails and recurring work orders stop. No work orders,
                users, or settings are deleted.
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => apply(true)}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {pending ? 'Pausing...' : 'Pause access'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {isOwn && !suspended ? (
        <p className="text-sm text-muted-foreground">
          This is your own organization, so it cannot be paused from here.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
