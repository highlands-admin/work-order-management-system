'use client'

import { useActionState, useEffect, useRef } from 'react'

import { FormError } from '@/components/auth/form-error'
import { SubmitButton } from '@/components/auth/submit-button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { initialAuthState } from '../../(auth)/auth-state'
import { addPropertyAction } from '../actions'

export function AddPropertyForm() {
  const [state, action] = useActionState(addPropertyAction, initialAuthState)
  const { markEdited, getError } = useServerErrors(state, state.fieldErrors)
  const nameError = getError('name')
  const formRef = useRef<HTMLFormElement>(null)

  // Clear the field after a successful add so the next name can go straight in.
  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset()
  }, [state])

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="flex flex-col gap-3"
    >
      <FormError state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field
          data-invalid={nameError ? 'true' : undefined}
          className="sm:max-w-sm"
        >
          <FieldLabel htmlFor="property-name" className="sr-only">
            Property name
          </FieldLabel>
          <Input
            id="property-name"
            name="name"
            placeholder="New property name"
            autoComplete="off"
            defaultValue={state.status === 'error' ? state.values?.name : ''}
            onChange={() => markEdited('name')}
            aria-invalid={nameError ? true : undefined}
            required
          />
          <FieldError>{nameError}</FieldError>
        </Field>
        <SubmitButton label="Add property" pendingLabel="Adding…" size="default" />
      </div>
      {state.status === 'success' && state.message ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
