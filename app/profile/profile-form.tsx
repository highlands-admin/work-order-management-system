'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { SubmitButton } from '@/components/auth/submit-button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useServerErrors } from '@/lib/hooks/use-server-errors'
import { type Property } from '@/lib/schemas/work-order'

import type { AuthState } from '../(auth)/auth-state'
import { initialAuthState } from '../(auth)/auth-state'
import { updateProfileAction } from './actions'

export function ProfileForm({
  email,
  firstName,
  lastName,
  selectedFacilities,
  facilities,
}: {
  email: string
  firstName: string
  lastName: string
  selectedFacilities: Property[]
  facilities: { value: Property; label: string }[]
}) {
  const [state, action] = useActionState(updateProfileAction, initialAuthState)
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)
  const firstNameError = getError('firstName')
  const lastNameError = getError('lastName')

  const selected = new Set(selectedFacilities)

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
      <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <section className="flex flex-col gap-5 p-6">
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

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" value={email} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              Contact an administrator to change your email.
            </p>
          </Field>
        </section>

        <section className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Your Facilities</h2>
            <p className="text-sm text-muted-foreground">
              Your work order lists open filtered to these. Leave empty to see
              all facilities.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {facilities.map((f) => (
              <label key={f.value} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="facilities"
                  value={f.value}
                  defaultChecked={selected.has(f.value)}
                  className="peer sr-only"
                />
                <span className="inline-flex items-center rounded-full border border-input px-3.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/60 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50">
                  {f.label}
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="flex justify-end">
        <SubmitButton label="Save changes" pendingLabel="Saving..." />
      </div>
    </form>
  )
}
