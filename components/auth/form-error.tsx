'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAutoDismiss } from '@/lib/hooks/use-auto-dismiss'
import type { AuthState } from '@/app/(auth)/auth-state'

export function FormError({ state }: { state: AuthState }) {
  const message = state.status === 'error' ? state.message : null
  const visible = useAutoDismiss(message)
  if (!message || !visible) return null
  return (
    <Alert variant="destructive" aria-live="polite">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
