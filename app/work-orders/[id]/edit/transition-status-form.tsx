'use client'

import { useActionState } from 'react'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
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
      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <p className="text-sm text-muted-foreground">
          This work order is <strong>{STATUS_LABELS[currentStatus]}</strong>.
          Your role has no available actions at this stage.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />

      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
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
