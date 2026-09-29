'use client'

import { useActionState, useEffect, useRef } from 'react'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { initialAuthState } from '../../(auth)/auth-state'
import { inviteOrganizationAdminAction } from '../actions'

export function InviteAdminForm({ organizationId }: { organizationId: string }) {
  const [state, action] = useActionState(
    inviteOrganizationAdminAction,
    initialAuthState
  )
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)
  const emailError = getError('email')
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset()
  }, [state])

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="flex flex-col gap-4"
    >
      <FormError state={state} />
      <input type="hidden" name="organizationId" value={organizationId} />

      <Field data-invalid={emailError ? 'true' : undefined}>
        <FieldLabel htmlFor="invite-admin-email">Email</FieldLabel>
        <Input
          id="invite-admin-email"
          name="email"
          type="email"
          autoComplete="off"
          placeholder="name@example.com"
          defaultValue={state.status === 'error' ? state.values?.email : ''}
          onChange={() => markEdited('email')}
          aria-invalid={emailError ? true : undefined}
          required
        />
        <FieldError>{emailError}</FieldError>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="invite-admin-first">
            First name (optional)
          </FieldLabel>
          <Input
            id="invite-admin-first"
            name="firstName"
            autoComplete="off"
            placeholder="Alex"
            defaultValue={state.status === 'error' ? state.values?.firstName : ''}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="invite-admin-last">
            Last name (optional)
          </FieldLabel>
          <Input
            id="invite-admin-last"
            name="lastName"
            autoComplete="off"
            placeholder="Doe"
            defaultValue={state.status === 'error' ? state.values?.lastName : ''}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton
          label="Send invitation"
          pendingLabel="Sending..."
          size="lg"
        />
        {state.status === 'success' && state.message ? (
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  )
}
