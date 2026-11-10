'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { EmailField } from '@/components/auth/email-field'
import { FormError } from '@/components/auth/form-error'
import {
  ConfirmPasswordChecklist,
  PasswordChecklist,
} from '@/components/auth/password-checklist'
import { PasswordInput } from '@/components/auth/password-input'
import { SubmitButton } from '@/components/auth/submit-button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { signUpAction } from '../actions'
import { initialAuthState, type AuthState } from '../auth-state'

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initialAuthState)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const debouncedPassword = useDebouncedValue(password, 250)
  const debouncedConfirmPassword = useDebouncedValue(confirmPassword, 250)
  const { markEdited, isEdited, getError } = useServerErrors(
    state,
    state.fieldErrors
  )
  const emailError = getError('email')
  const firstNameError = getError('firstName')
  const lastNameError = getError('lastName')
  const showPasswordErrors = Boolean(getError('password'))
  // Each submission returns a new state object, so closing the popup only
  // hides it for the response it was shown for.
  const [dismissedState, setDismissedState] = useState<AuthState | null>(null)
  const accountExistsOpen = Boolean(state.accountExists) && dismissedState !== state
  const showConfirmErrors =
    Boolean(getError('confirmPassword')) && !isEdited('password')

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError state={state} />

      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={firstNameError ? 'true' : undefined}>
          <FieldLabel htmlFor="firstName">First name</FieldLabel>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            autoFocus
            placeholder="Alex"
            defaultValue={state.values?.firstName}
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
            defaultValue={state.values?.lastName}
            onChange={() => markEdited('lastName')}
            aria-invalid={lastNameError ? true : undefined}
            required
          />
          <FieldError>{lastNameError}</FieldError>
        </Field>
      </div>

      <EmailField
        defaultValue={state.values?.email}
        serverError={emailError}
        onValueChange={() => markEdited('email')}
        required
      />
      <AlertDialog
        open={accountExistsOpen}
        onOpenChange={(open) => {
          if (!open) setDismissedState(state)
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>You already have an account</AlertDialogTitle>
          <AlertDialogDescription>
            An account with{' '}
            <span className="font-medium text-foreground">
              {state.values?.email}
            </span>{' '}
            already exists, so no code was sent. Sign in, or reset your password
            if you do not remember it.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <Link
              href="/login"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Sign in
            </Link>
            <Link
              href={`/forgot-password?email=${encodeURIComponent(state.values?.email ?? '')}`}
              className={buttonVariants({ size: 'sm' })}
            >
              Reset password
            </Link>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <SubmitButton
        label="Create account"
        pendingLabel="Creating account..."
        className="w-full"
      />
    </form>
  )
}
