'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { EmailField } from '@/components/auth/email-field'
import { FormError } from '@/components/auth/form-error'
import { PasswordInput } from '@/components/auth/password-input'
import { SubmitButton } from '@/components/auth/submit-button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { loginAction } from '../actions'
import { initialAuthState } from '../auth-state'

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialAuthState)
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)
  const emailError = getError('email')
  const passwordError = getError('password')

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError state={state} />

      <EmailField
        defaultValue={state.values?.email}
        serverError={emailError}
        onValueChange={() => markEdited('email')}
        autoFocus
        required
      />

      <Field data-invalid={passwordError ? 'true' : undefined}>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          onChange={() => markEdited('password')}
          aria-invalid={passwordError ? true : undefined}
          required
        />
        <FieldError>{passwordError}</FieldError>
      </Field>

      <SubmitButton label="Sign in" pendingLabel="Signing in..." className="w-full" />
    </form>
  )
}
