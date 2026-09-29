'use client'

import { useActionState } from 'react'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { initialAuthState } from '../../(auth)/auth-state'
import { updateOrganizationAction } from '../actions'

export function OrganizationSettingsForm({
  organizationId,
  name,
  domain,
}: {
  organizationId: string
  name: string
  domain: string | null
}) {
  const [state, action] = useActionState(
    updateOrganizationAction,
    initialAuthState
  )
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)
  const nameError = getError('name')
  const domainError = getError('domain')

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError state={state} />
      <input type="hidden" name="organizationId" value={organizationId} />

      <Field data-invalid={nameError ? 'true' : undefined}>
        <FieldLabel htmlFor="settings-name">Organization name</FieldLabel>
        <Input
          id="settings-name"
          name="name"
          autoComplete="off"
          defaultValue={state.values?.name ?? name}
          onChange={() => markEdited('name')}
          aria-invalid={nameError ? true : undefined}
          required
        />
        <FieldError>{nameError}</FieldError>
      </Field>

      <Field data-invalid={domainError ? 'true' : undefined}>
        <FieldLabel htmlFor="settings-domain">Signup domain (optional)</FieldLabel>
        <Input
          id="settings-domain"
          name="domain"
          autoComplete="off"
          placeholder="example.com"
          defaultValue={state.values?.domain ?? domain ?? ''}
          onChange={() => markEdited('domain')}
          aria-invalid={domainError ? true : undefined}
        />
        <FieldDescription>
          Leave blank to allow invitations only. Changing it does not affect
          existing members.
        </FieldDescription>
        <FieldError>{domainError}</FieldError>
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton label="Save changes" pendingLabel="Saving..." size="lg" />
        {state.status === 'success' && state.message ? (
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  )
}
