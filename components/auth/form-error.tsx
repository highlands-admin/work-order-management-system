import { Alert, AlertDescription } from '@/components/ui/alert'
import type { AuthState } from '@/app/(auth)/auth-state'

export function FormError({ state }: { state: AuthState }) {
  if (state.status !== 'error' || !state.message) return null
  return (
    <Alert variant="destructive" aria-live="polite">
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  )
}
