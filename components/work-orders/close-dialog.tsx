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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  NOTE_MAX_LENGTH,
  NOTE_TOO_LONG_MESSAGE,
} from '@/lib/schemas/work-order'
import {
  formatAssigneeLabel,
  type AssignableUser,
} from '@/lib/work-orders/assignable-users'

// Controlled modal for closing a work order. Always collects the validator (a
// dropdown of users, like the Assignee field) and an optional note, so the
// closer can record context without opening the work order afterward. It also
// collects a resolution when the work order is not already Done, since a direct
// Open/In Progress -> Closed move has no resolution yet. Used by the imperative
// status surfaces (the detail-page status picker and the kanban board), which
// call a Server Action directly.
export function CloseDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  users,
  requireResolution,
  pending = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (values: {
    resolution?: string
    validatedBy: string
    note?: string
  }) => void
  onCancel?: () => void
  users: AssignableUser[]
  requireResolution: boolean
  pending?: boolean
}) {
  const [resolution, setResolution] = useState('')
  const [validatedBy, setValidatedBy] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<{
    resolution?: string
    validatedBy?: string
    note?: string
  }>({})

  const userItems = Object.fromEntries(
    users.map((u) => [u.user_id, formatAssigneeLabel(u)])
  )

  function reset() {
    setResolution('')
    setValidatedBy('')
    setNote('')
    setErrors({})
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      onCancel?.()
      reset()
    }
    onOpenChange(next)
  }

  function confirm() {
    const nextErrors: typeof errors = {}
    const trimmed = resolution.trim()
    if (requireResolution && !trimmed) {
      nextErrors.resolution = 'A resolution is required to close a work order.'
    }
    if (!validatedBy) {
      nextErrors.validatedBy = 'Select who validated this work order.'
    }
    // The note is optional, but one that is too long would fail server-side
    // validation and revert the status change, so catch it here instead.
    const trimmedNote = note.trim()
    if (trimmedNote.length > NOTE_MAX_LENGTH) {
      nextErrors.note = NOTE_TOO_LONG_MESSAGE
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    onConfirm({
      resolution: requireResolution ? trimmed : undefined,
      validatedBy,
      note: trimmedNote || undefined,
    })
    reset()
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>Close work order</AlertDialogTitle>
        <AlertDialogDescription>
          {requireResolution
            ? 'Add a resolution and record who validated the completed work.'
            : 'Record who validated the completed work.'}
        </AlertDialogDescription>

        <div className="flex flex-col gap-4">
          {requireResolution ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="close-resolution" className="text-sm font-medium">
                Resolution
              </label>
              <Textarea
                id="close-resolution"
                rows={4}
                autoFocus
                value={resolution}
                onChange={(e) => {
                  setResolution(e.target.value)
                  if (errors.resolution) {
                    setErrors((p) => ({ ...p, resolution: undefined }))
                  }
                }}
                aria-invalid={errors.resolution ? true : undefined}
                placeholder="What was done to resolve this work order?"
              />
              {errors.resolution ? (
                <p className="text-sm text-destructive">{errors.resolution}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="close-validated-by" className="text-sm font-medium">
              Validated by
            </label>
            <Select
              items={userItems}
              value={validatedBy}
              onValueChange={(v) => {
                setValidatedBy(typeof v === 'string' ? v : '')
                if (errors.validatedBy) {
                  setErrors((p) => ({ ...p, validatedBy: undefined }))
                }
              }}
            >
              <SelectTrigger
                id="close-validated-by"
                className="w-full"
                aria-invalid={errors.validatedBy ? true : undefined}
              >
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {formatAssigneeLabel(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.validatedBy ? (
              <p className="text-sm text-destructive">{errors.validatedBy}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="close-note" className="text-sm font-medium">
              Note{' '}
              <span
                className="text-xs font-normal text-muted-foreground"
                aria-hidden="true"
              >
                (optional)
              </span>
            </label>
            <Textarea
              id="close-note"
              rows={3}
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                if (errors.note) {
                  setErrors((p) => ({ ...p, note: undefined }))
                }
              }}
              aria-invalid={errors.note ? true : undefined}
              placeholder="Anything else worth recording on this work order?"
            />
            {errors.note ? (
              <p className="text-sm text-destructive">{errors.note}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Added to the work order as a note from you.
            </p>
          </div>
        </div>

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
            {pending ? 'Closing…' : 'Close work order'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
