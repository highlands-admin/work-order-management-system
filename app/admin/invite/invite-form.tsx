'use client'

import { useActionState } from 'react'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useServerErrors } from '@/lib/hooks/use-server-errors'
import { APP_ROLES, ROLE_LABELS } from '@/lib/schemas/admin'

import { initialAuthState } from '../../(auth)/auth-state'
import { inviteUserAction } from '../actions'

export function InviteForm() {
  const [state, action] = useActionState(inviteUserAction, initialAuthState)
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)
  const emailError = getError('email')
  const roleError = getError('role')
  const firstNameError = getError('firstName')
  const lastNameError = getError('lastName')

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError state={state} />

      {state.status === 'success' && state.message ? (
        <Alert aria-live="polite">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <Field data-invalid={emailError ? 'true' : undefined}>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          autoFocus
          defaultValue={state.values?.email}
          onChange={() => markEdited('email')}
          aria-invalid={emailError ? true : undefined}
          required
        />
        <FieldError>{emailError}</FieldError>
      </Field>

      <Field data-invalid={roleError ? 'true' : undefined}>
        <FieldLabel htmlFor="role">Role</FieldLabel>
        <select
          id="role"
          name="role"
          defaultValue={state.values?.role ?? 'technician'}
          onChange={() => markEdited('role')}
          aria-invalid={roleError ? true : undefined}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30"
          required
        >
          {APP_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <FieldError>{roleError}</FieldError>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={firstNameError ? 'true' : undefined}>
          <FieldLabel htmlFor="firstName">First name (optional)</FieldLabel>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="off"
            defaultValue={state.values?.firstName}
            onChange={() => markEdited('firstName')}
            aria-invalid={firstNameError ? true : undefined}
          />
          <FieldError>{firstNameError}</FieldError>
        </Field>

        <Field data-invalid={lastNameError ? 'true' : undefined}>
          <FieldLabel htmlFor="lastName">Last name (optional)</FieldLabel>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="off"
            defaultValue={state.values?.lastName}
            onChange={() => markEdited('lastName')}
            aria-invalid={lastNameError ? true : undefined}
          />
          <FieldError>{lastNameError}</FieldError>
        </Field>
      </div>

      <SubmitButton label="Send invitation" pendingLabel="Sending..." />
    </form>
  )
}
