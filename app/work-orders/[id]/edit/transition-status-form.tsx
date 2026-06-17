'use client'

import { useActionState } from 'react'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
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
import { Textarea } from '@/components/ui/textarea'
import {
  STATUS_LABELS,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'

import { initialAuthState } from '../../../(auth)/auth-state'
import { transitionWorkOrderStatusAction } from '../../actions'

const TECHNICIAN_TRANSITIONS: Partial<Record<WorkOrderStatus, WorkOrderStatus>> =
  {
    open: 'in_progress',
    in_progress: 'done',
  }

const INSPECTOR_TRANSITIONS: Partial<Record<WorkOrderStatus, WorkOrderStatus>> =
  {
    done: 'closed',
  }

export function TransitionStatusForm({
  workOrderId,
  currentStatus,
  role,
}: {
  workOrderId: string
  currentStatus: WorkOrderStatus
  role: 'technician' | 'inspector'
}) {
  const target =
    role === 'technician'
      ? TECHNICIAN_TRANSITIONS[currentStatus]
      : INSPECTOR_TRANSITIONS[currentStatus]

  const boundAction = transitionWorkOrderStatusAction.bind(
    null,
    workOrderId,
    currentStatus
  )
  const [state, action] = useActionState(boundAction, initialAuthState)

  if (!target) {
    return (
      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10 shadow-md dark:shadow-none">
        <p className="text-sm text-muted-foreground">
          This work order is <strong>{STATUS_LABELS[currentStatus]}</strong>.
          Your role has no available actions at this stage.
        </p>
      </div>
    )
  }

  // Completing the work (-> done) requires a resolution, collected in a modal.
  // The modal's Cancel leaves the status unchanged.
  if (target === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10 shadow-md dark:shadow-none">
          <p className="text-sm">
            Move this work order from{' '}
            <strong>{STATUS_LABELS[currentStatus]}</strong> to{' '}
            <strong>{STATUS_LABELS[target]}</strong>. You will add a resolution
            before completing.
          </p>
        </div>

        <div className="flex items-center justify-end">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button type="button">Mark as {STATUS_LABELS[target]}</Button>
              }
            />
            <AlertDialogContent>
              <form action={action} className="flex flex-col gap-3">
                <AlertDialogTitle>Mark as Done</AlertDialogTitle>
                <AlertDialogDescription>
                  Describe how this work order was resolved. This is required to
                  mark it done.
                </AlertDialogDescription>

                <input type="hidden" name="status" value={target} />
                <Textarea
                  name="resolution"
                  rows={4}
                  required
                  autoFocus
                  placeholder="What was done to resolve this work order?"
                />
                <FormError state={state} />

                <AlertDialogFooter>
                  <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                  <SubmitButton label="Mark as Done" pendingLabel="Updating..." />
                </AlertDialogFooter>
              </form>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />

      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10 shadow-md dark:shadow-none">
        <p className="text-sm">
          Move this work order from{' '}
          <strong>{STATUS_LABELS[currentStatus]}</strong> to{' '}
          <strong>{STATUS_LABELS[target]}</strong>.
        </p>
      </div>

      <input type="hidden" name="status" value={target} />

      <div className="flex items-center justify-end">
        <SubmitButton
          label={`Mark as ${STATUS_LABELS[target]}`}
          pendingLabel="Updating..."
        />
      </div>
    </form>
  )
}
