'use client'

import { useActionState, useState } from 'react'

import { FormError } from '@/components/auth/form-error'
import { SixDigitOtp } from '@/components/auth/six-digit-otp'
import { SubmitButton } from '@/components/auth/submit-button'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { verifyResetOtpAction } from '../../actions'
import { initialAuthState } from '../../auth-state'

export function VerifyResetForm({ email }: { email: string }) {
  const [state, action] = useActionState(verifyResetOtpAction, initialAuthState)
  const [token, setToken] = useState('')
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)
  const tokenError = getError('token')

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
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
        label="Verify code"
        pendingLabel="Verifying..."
        disabled={token.length < 6}
        className="w-full"
      />

      <FormError state={state} />
    </form>
  )
}
