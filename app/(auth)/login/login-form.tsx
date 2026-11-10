'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { FormError } from '@/components/auth/form-error'
import { PasswordInput } from '@/components/auth/password-input'
import { SubmitButton } from '@/components/auth/submit-button'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useServerErrors } from '@/lib/hooks/use-server-errors'

import { loginAction, sendLoginCodeAction } from '../actions'
import { initialAuthState } from '../auth-state'

type Step = 'email' | 'method' | 'password'

// Matches the shape check in the email field schema closely enough to catch
// typos before moving on. The Server Actions validate the address again.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Two-step sign-in: the user enters their email, then chooses to sign in with
// their password or with a 6-digit code emailed to them.
export function LoginForm() {
  const [passwordState, passwordAction] = useActionState(
    loginAction,
    initialAuthState
  )
  const [codeState, codeAction] = useActionState(
    sendLoginCodeAction,
    initialAuthState
  )
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const { markEdited, getError } = useServerErrors(
    passwordState,
    passwordState.fieldErrors
  )
  const passwordError = getError('password')

  function continueWithEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError('Enter a valid email address')
      return
    }
    setEmail(trimmed)
    setEmailError(null)
    setStep('method')
  }

  if (step === 'email') {
    return (
      <form onSubmit={continueWithEmail} noValidate className="flex flex-col gap-4">
        <Field data-invalid={emailError ? 'true' : undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailError(null)
            }}
            aria-invalid={emailError ? true : undefined}
            required
          />
          <FieldError>{emailError}</FieldError>
        </Field>

        <Button type="submit" size="cta" className="w-full">
          Continue
        </Button>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <span className="truncate font-medium">{email}</span>
        <button
          type="button"
          onClick={() => setStep('email')}
          className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Change
        </button>
      </div>

      {step === 'password' ? (
        <form action={passwordAction} noValidate className="flex flex-col gap-4">
          <FormError state={passwordState} />
          <input type="hidden" name="email" value={email} />

          <Field data-invalid={passwordError ? 'true' : undefined}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href={`/forgot-password?email=${encodeURIComponent(email)}`}
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              autoFocus
              onChange={() => markEdited('password')}
              aria-invalid={passwordError ? true : undefined}
              required
            />
            <FieldError>{passwordError}</FieldError>
          </Field>

          <SubmitButton label="Sign in" pendingLabel="Signing in..." className="w-full" />

          <button
            type="button"
            onClick={() => setStep('method')}
            className="text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Use a different sign-in method
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <FormError state={codeState} />
          <Button
            type="button"
            size="cta"
            className="w-full"
            onClick={() => setStep('password')}
          >
            Sign in with password
          </Button>

          <form action={codeAction} noValidate className="flex flex-col gap-3">
            <input type="hidden" name="email" value={email} />
            <SubmitButton
              label="Email me a sign-in code"
              pendingLabel="Sending code..."
              variant="outline"
              className="w-full"
            />
          </form>
        </div>
      )}
    </div>
  )
}
