'use client'

import { useActionState, useState } from 'react'

import { FormError } from '@/components/auth/form-error'
import {
  ConfirmPasswordChecklist,
  PasswordChecklist,
} from '@/components/auth/password-checklist'
import { PasswordInput } from '@/components/auth/password-input'
import { SubmitButton } from '@/components/auth/submit-button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { acceptInviteAction } from '../actions'
import { initialAuthState } from '../auth-state'

export function AcceptInviteForm({
  token,
  firstName: initialFirstName,
  lastName: initialLastName,
}: {
  token: string
  firstName: string
  lastName: string
}) {
  const [state, action] = useActionState(acceptInviteAction, initialAuthState)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const debouncedPassword = useDebouncedValue(password, 250)
  const debouncedConfirmPassword = useDebouncedValue(confirmPassword, 250)
  const { markEdited, isEdited, getError } = useServerErrors(
    state,
    state.fieldErrors
  )
  const firstNameError = getError('firstName')
  const lastNameError = getError('lastName')
  const showPasswordErrors = Boolean(getError('password'))
  const showConfirmErrors =
    Boolean(getError('confirmPassword')) && !isEdited('password')

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError state={state} />

      <input type="hidden" name="token" value={token} />

      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={firstNameError ? 'true' : undefined}>
          <FieldLabel htmlFor="firstName">First name</FieldLabel>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            autoFocus
            placeholder="Alex"
            defaultValue={state.values?.firstName ?? initialFirstName}
            onChange={() => markEdited('firstName')}
            aria-invalid={firstNameError ? true : undefined}
            required
          />
          <FieldError>{firstNameError}</FieldError>
        </Field>

        <Field data-invalid={lastNameError ? 'true' : undefined}>
          <FieldLabel htmlFor="lastName">Last name</FieldLabel>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            placeholder="Doe"
            defaultValue={state.values?.lastName ?? initialLastName}
            onChange={() => markEdited('lastName')}
            aria-invalid={lastNameError ? true : undefined}
            required
          />
          <FieldError>{lastNameError}</FieldError>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          placeholder="Create a strong password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            markEdited('password')
          }}
          required
        />
        <PasswordChecklist
          value={debouncedPassword}
          showErrors={showPasswordErrors}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            markEdited('confirmPassword')
          }}
          required
        />
        <ConfirmPasswordChecklist
          value={debouncedConfirmPassword}
          password={debouncedPassword}
          showErrors={showConfirmErrors}
        />
      </Field>

      <SubmitButton label="Create Account" pendingLabel="Creating Account..." />
    </form>
  )
}