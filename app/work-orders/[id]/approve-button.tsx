'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { SubmitButton } from '@/components/auth/submit-button'

import type { AuthState } from '../../(auth)/auth-state'
import { initialAuthState } from '../../(auth)/auth-state'
import { approveWorkOrderAction } from '../actions'

// Approves a pending work order straight from its detail page. Only rendered for
// administrators viewing a pending work order; the action re-checks the role and
// RLS enforces it independently.
export function ApproveButton({ workOrderId }: { workOrderId: string }) {
  const boundApprove = approveWorkOrderAction.bind(null, workOrderId)
  const [state, action] = useActionState(boundApprove, initialAuthState)

  const prevState = useRef<AuthState>(initialAuthState)
  useEffect(() => {
    if (prevState.current === state) return
    prevState.current = state
    if (state.status === 'success') {
      toast.success(state.message ?? 'Work order approved.')
    } else if (state.status === 'error' && state.message) {
      toast.error(state.message)
    }
  }, [state])

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <SubmitButton label="Approve" pendingLabel="Approving..." size="lg" />
    </form>
  )
}
