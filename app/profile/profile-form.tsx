'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { SubmitButton } from '@/components/auth/submit-button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import type { AuthState } from '../(auth)/auth-state'
import { initialAuthState } from '../(auth)/auth-state'
import { updateProfileAction } from './actions'

export function ProfileForm({
  email,
  firstName,
  lastName,
  phone,
}: {
  email: string
  firstName: string
  lastName: string
  phone: string
}) {
  const [state, action] = useActionState(updateProfileAction, initialAuthState)
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)
  const firstNameError = getError('firstName')
  const lastNameError = getError('lastName')
  const phoneError = getError('phone')

  const prev = useRef<AuthState>(initialAuthState)
  useEffect(() => {
    if (prev.current === state) return
    prev.current = state
    if (state.status === 'success') {
      toast.success(state.message ?? 'Changes saved.')
    } else if (state.status === 'error' && state.message) {
      toast.error(state.message)
    }
  }, [state])

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={firstNameError ? 'true' : undefined}>
              <FieldLabel htmlFor="firstName">First name</FieldLabel>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={state.values?.firstName ?? firstName}
                onChange={() => markEdited('firstName')}
                aria-invalid={firstNameError ? true : undefined}
                autoComplete="given-name"
                required
              />
              <FieldError>{firstNameError}</FieldError>
            </Field>

            <Field data-invalid={lastNameError ? 'true' : undefined}>
              <FieldLabel htmlFor="lastName">Last name</FieldLabel>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={state.values?.lastName ?? lastName}
                onChange={() => markEdited('lastName')}
                aria-invalid={lastNameError ? true : undefined}
                autoComplete="family-name"
              />
              <FieldError>{lastNameError}</FieldError>
            </Field>
          </div>

          <Field data-invalid={phoneError ? 'true' : undefined}>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <PhoneInput
              id="phone"
              name="phone"
              placeholder="(555) 123-4567"
              defaultValue={state.values?.phone ?? phone}
              onValueChange={() => markEdited('phone')}
              aria-invalid={phoneError ? true : undefined}
              autoComplete="tel"
            />
            <FieldError>{phoneError}</FieldError>
            <p className="text-xs text-muted-foreground">
              Used to pre-fill the reporter details on new work orders.
            </p>
          </Field>

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" defaultValue={email} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              Contact an administrator to change your email.
            </p>
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton label="Save changes" pendingLabel="Saving..." />
      </div>
    </form>
  )
}
