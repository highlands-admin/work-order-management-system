'use client'

import { useActionState, useState } from 'react'

import { FormError } from '@/components/auth/form-error'
import {
  ConfirmPasswordChecklist,
  PasswordChecklist,
} from '@/components/auth/password-checklist'
import { PasswordInput } from '@/components/auth/password-input'
import { SubmitButton } from '@/components/auth/submit-button'
import { Field, FieldLabel } from '@/components/ui/field'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { updatePasswordAction } from '../actions'
import { initialAuthState } from '../auth-state'

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, initialAuthState)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const debouncedPassword = useDebouncedValue(password, 250)
  const debouncedConfirmPassword = useDebouncedValue(confirmPassword, 250)
  const { markEdited, isEdited, getError } = useServerErrors(
    state,
    state.fieldErrors
  )
  const showPasswordErrors = Boolean(getError('password'))
  const showConfirmErrors =
    Boolean(getError('confirmPassword')) && !isEdited('password')

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError state={state} />

      <Field>
        <FieldLabel htmlFor="password">New password</FieldLabel>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          autoFocus
          placeholder="Create a new password"
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
        <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter the new password"
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

      <SubmitButton label="Update password" pendingLabel="Updating..." />
    </form>
  )
}
