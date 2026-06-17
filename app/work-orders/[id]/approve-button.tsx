'use client'

import { useActionState } from 'react'

import { SubmitButton } from '@/components/auth/submit-button'

import { initialAuthState } from '../../(auth)/auth-state'
import { approveWorkOrderAction } from '../actions'

// Approves a pending work order straight from its detail page. Only rendered for
// administrators viewing a pending work order; the action re-checks the role and
// RLS enforces it independently.
export function ApproveButton({ workOrderId }: { workOrderId: string }) {
  const boundApprove = approveWorkOrderAction.bind(null, workOrderId)
  const [state, action] = useActionState(boundApprove, initialAuthState)

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <SubmitButton label="Approve" pendingLabel="Approving..." size="lg" />
      {state.status === 'error' && state.message ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
    </form>
  )
}
