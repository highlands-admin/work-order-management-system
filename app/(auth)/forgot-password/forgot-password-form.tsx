'use client'

import { useActionState } from 'react'

import { EmailField } from '@/components/auth/email-field'
import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { forgotPasswordAction } from '../actions'
import { initialAuthState } from '../auth-state'

export function ForgotPasswordForm() {
  const [state, action] = useActionState(
    forgotPasswordAction,
    initialAuthState
  )
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError state={state} />

      <EmailField
        defaultValue={state.values?.email}
        serverError={getError('email')}
        onValueChange={() => markEdited('email')}
        autoFocus
        required
      />

      <SubmitButton label="Send code" pendingLabel="Sending code..." className="w-full" />
    </form>
  )
}
