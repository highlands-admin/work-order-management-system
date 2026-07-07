'use client'

import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// Controlled modal that collects the required reason when an administrator
// rejects a work order directly from the main table (as opposed to the
// approval queue's inline reject form). Mirrors ResolutionDialog's shape.
// Closing the dialog without confirming cancels the reject via onCancel.
export function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  pending = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  onCancel?: () => void
  pending?: boolean
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setReason('')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      onCancel?.()
      reset()
    }
    onOpenChange(next)
  }

  function confirm() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError('Provide a reason for rejection.')
      return
    }
    onConfirm(trimmed)
    reset()
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>Reject Work Order</AlertDialogTitle>
        <AlertDialogDescription>
          The work order moves to the Archive, and the creator is notified
          with your reason below.
        </AlertDialogDescription>
        <Textarea
          autoFocus
          rows={4}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            if (error) setError(null)
          }}
          aria-invalid={error ? true : undefined}
          placeholder="Why is this work order being rejected?"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={confirm}
            disabled={pending}
          >
            {pending ? 'Rejecting…' : 'Reject'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
