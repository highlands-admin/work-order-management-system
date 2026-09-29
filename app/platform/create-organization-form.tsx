'use client'

import { useActionState } from 'react'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { initialAuthState } from '../(auth)/auth-state'
import { createOrganizationAction } from './actions'

export function CreateOrganizationForm() {
  const [state, action] = useActionState(
    createOrganizationAction,
    initialAuthState
  )
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)
  const nameError = getError('name')
  const domainError = getError('domain')
  const adminEmailError = getError('adminEmail')

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError state={state} />

      <Field data-invalid={nameError ? 'true' : undefined}>
        <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
        <Input
          id="org-name"
          name="name"
          autoComplete="off"
          defaultValue={state.values?.name}
          onChange={() => markEdited('name')}
          aria-invalid={nameError ? true : undefined}
          required
        />
        <FieldError>{nameError}</FieldError>
      </Field>

      <Field data-invalid={domainError ? 'true' : undefined}>
        <FieldLabel htmlFor="org-domain">Signup domain</FieldLabel>
        <Input
          id="org-domain"
          name="domain"
          autoComplete="off"
          placeholder="example.com"
          defaultValue={state.values?.domain}
          onChange={() => markEdited('domain')}
          aria-invalid={domainError ? true : undefined}
        />
        <FieldDescription>
          People with an email at this domain can sign up and join as
          requesters. Leave blank to allow invitations only.
        </FieldDescription>
        <FieldError>{domainError}</FieldError>
      </Field>

      <Field data-invalid={adminEmailError ? 'true' : undefined}>
        <FieldLabel htmlFor="org-admin-email">
          First administrator&apos;s email
        </FieldLabel>
        <Input
          id="org-admin-email"
          name="adminEmail"
          type="email"
          autoComplete="off"
          defaultValue={state.values?.adminEmail}
          onChange={() => markEdited('adminEmail')}
          aria-invalid={adminEmailError ? true : undefined}
          required
        />
        <FieldDescription>
          They receive an invitation to join as an administrator.
        </FieldDescription>
        <FieldError>{adminEmailError}</FieldError>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="org-admin-first">First name</FieldLabel>
          <Input
            id="org-admin-first"
            name="adminFirstName"
            autoComplete="off"
            defaultValue={state.values?.adminFirstName}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="org-admin-last">Last name</FieldLabel>
          <Input
            id="org-admin-last"
            name="adminLastName"
            autoComplete="off"
            defaultValue={state.values?.adminLastName}
          />
        </Field>
      </div>

      <SubmitButton
        label="Create organization"
        pendingLabel="Creating…"
        className="self-start"
      />
    </form>
  )
}
