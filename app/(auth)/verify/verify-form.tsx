'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { FormError } from '@/components/auth/form-error'
import { SixDigitOtp } from '@/components/auth/six-digit-otp'
import { SubmitButton } from '@/components/auth/submit-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { resendVerificationAction, verifyAction } from '../actions'
import { initialAuthState } from '../auth-state'

export function VerifyForm({ email }: { email: string }) {
  const [state, action] = useActionState(verifyAction, initialAuthState)
  const [token, setToken] = useState('')
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)
  const tokenError = getError('token')

  return (
    <div className="flex flex-col gap-4">
      <form action={action} noValidate className="flex flex-col gap-4">
        <FormError state={state} />

        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="token" value={token} />

        <div className="flex flex-col items-center gap-2">
          <SixDigitOtp
            value={token}
            onChange={(v) => {
              setToken(v)
              markEdited('token')
            }}
            invalid={Boolean(tokenError)}
            autoFocus
            
          />
          {tokenError ? (
            <p className="text-xs text-destructive">{tokenError}</p>
          ) : null}
        </div>

        <SubmitButton
          label="Verify email"
          pendingLabel="Verifying..."
          disabled={token.length < 6}
        />
      </form>

      <ResendBlock email={email} />
    </div>
  )
}

function ResendBlock({ email }: { email: string }) {
  const [state, action] = useActionState(
    resendVerificationAction,
    initialAuthState
  )

  return (
    <div className="flex flex-col gap-3">
      <form action={action} noValidate className="text-center text-sm text-muted-foreground">
        <input type="hidden" name="email" value={email} />
        Did not receive a code?{' '}
        <ResendButton />
      </form>
      {state.status === 'success' && state.message ? (
        <Alert variant="success" aria-live="polite">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.status === 'error' && state.message ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

function ResendButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
    >
      {pending ? 'Sending...' : 'Resend'}
    </button>
  )
}
