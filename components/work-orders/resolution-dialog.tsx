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

// Controlled modal that collects the required resolution when a work order is
// moved to Done. Used by the imperative status surfaces (the detail-page status
// picker and the kanban board), which call a Server Action directly. Closing the
// dialog without confirming cancels the move via onCancel.
export function ResolutionDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  pending = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (resolution: string) => void
  onCancel?: () => void
  pending?: boolean
}) {
  const [resolution, setResolution] = useState('')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setResolution('')
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
    const trimmed = resolution.trim()
    if (!trimmed) {
      setError('A resolution is required to mark a work order done.')
      return
    }
    onConfirm(trimmed)
    reset()
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>Mark as Done</AlertDialogTitle>
        <AlertDialogDescription>
          Describe how this work order was resolved. This is required to mark it
          done.
        </AlertDialogDescription>
        <Textarea
          autoFocus
          rows={4}
          value={resolution}
          onChange={(e) => {
            setResolution(e.target.value)
            if (error) setError(null)
          }}
          aria-invalid={error ? true : undefined}
          placeholder="What was done to resolve this work order?"
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
          <Button type="button" size="sm" onClick={confirm} disabled={pending}>
            {pending ? 'Saving…' : 'Mark as Done'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
