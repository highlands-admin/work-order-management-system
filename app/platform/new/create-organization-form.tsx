'use client'

import { useActionState } from 'react'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { initialAuthState } from '../../(auth)/auth-state'
import { createOrganizationAction } from '../actions'

export function CreateOrganizationForm() {
  const [state, action] = useActionState(
    createOrganizationAction,
    initialAuthState
  )
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)
  const nameError = getError('name')
  const domainError = getError('domain')
  const adminEmailError = getError('adminEmail')
  const adminFirstNameError = getError('adminFirstName')
  const adminLastNameError = getError('adminLastName')

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError state={state} />

      <Field data-invalid={nameError ? 'true' : undefined}>
        <FieldLabel htmlFor="name">Organization name</FieldLabel>
        <Input
          id="name"
          name="name"
          autoComplete="off"
          autoFocus
          placeholder="Acme Senior Living"
          defaultValue={state.values?.name}
          onChange={() => markEdited('name')}
          aria-invalid={nameError ? true : undefined}
          required
        />
        <FieldError>{nameError}</FieldError>
      </Field>

      <Field data-invalid={domainError ? 'true' : undefined}>
        <FieldLabel htmlFor="domain">Signup domain (optional)</FieldLabel>
        <Input
          id="domain"
          name="domain"
          autoComplete="off"
          placeholder="example.com"
          defaultValue={state.values?.domain}
          onChange={() => markEdited('domain')}
          aria-invalid={domainError ? true : undefined}
        />
        <FieldDescription>
          Anyone with an email at this domain can sign up as a requester. Leave
          blank to allow invitations only.
        </FieldDescription>
        <FieldError>{domainError}</FieldError>
      </Field>

      <Separator className="my-1" />

      <div>
        <p className="text-sm font-medium">First administrator</p>
        <p className="text-sm text-muted-foreground">
          They receive an email invitation and set their own password.
        </p>
      </div>

      <Field data-invalid={adminEmailError ? 'true' : undefined}>
        <FieldLabel htmlFor="adminEmail">Email</FieldLabel>
        <Input
          id="adminEmail"
          name="adminEmail"
          type="email"
          autoComplete="off"
          placeholder="name@example.com"
          defaultValue={state.values?.adminEmail}
          onChange={() => markEdited('adminEmail')}
          aria-invalid={adminEmailError ? true : undefined}
          required
        />
        <FieldError>{adminEmailError}</FieldError>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={adminFirstNameError ? 'true' : undefined}>
          <FieldLabel htmlFor="adminFirstName">First name (optional)</FieldLabel>
          <Input
            id="adminFirstName"
            name="adminFirstName"
            autoComplete="off"
            placeholder="Alex"
            defaultValue={state.values?.adminFirstName}
            onChange={() => markEdited('adminFirstName')}
            aria-invalid={adminFirstNameError ? true : undefined}
          />
          <FieldError>{adminFirstNameError}</FieldError>
        </Field>

        <Field data-invalid={adminLastNameError ? 'true' : undefined}>
          <FieldLabel htmlFor="adminLastName">Last name (optional)</FieldLabel>
          <Input
            id="adminLastName"
            name="adminLastName"
            autoComplete="off"
            placeholder="Doe"
            defaultValue={state.values?.adminLastName}
            onChange={() => markEdited('adminLastName')}
            aria-invalid={adminLastNameError ? true : undefined}
          />
          <FieldError>{adminLastNameError}</FieldError>
        </Field>
      </div>

      <SubmitButton
        label="Create organization"
        pendingLabel="Creating..."
        size="lg"
        className="w-full"
      />
    </form>
  )
}
