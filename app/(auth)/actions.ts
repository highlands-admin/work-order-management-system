'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  loginSchema,
  updatePasswordSchema,
  verifySchema,
} from '@/lib/schemas/auth'

import type { AuthState } from './auth-state'

function formError(
  fieldErrors: Record<string, string[]> | undefined,
  values: Record<string, string>,
  message?: string
): AuthState {
  return { status: 'error', fieldErrors, values, message }
}

export async function acceptInviteAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = {
    token: String(formData.get('token') ?? ''),
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  }

  const parsed = acceptInviteSchema.safeParse(raw)
  const safeValues = {
    firstName: raw.firstName,
    lastName: raw.lastName,
  }
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), safeValues)
  }

  const supabase = await createClient()

  // Look up the invitation by token. This uses a SECURITY DEFINER function so
  // anonymous users can validate their own token without exposing the full table.
  const { data: invites, error: lookupError } = await supabase.rpc(
    'invitation_by_token',
    { p_token: parsed.data.token }
  )

  if (lookupError) {
    return formError(undefined, safeValues, lookupError.message)
  }

  const invite = invites?.[0]
  if (!invite) {
    return formError(
      undefined,
      safeValues,
      'This invitation is invalid, expired, or already used. Ask an administrator for a new one.'
    )
  }

  const { error: signUpError } = await supabase.auth.signUp({
    email: invite.email,
    password: parsed.data.password,
    options: {
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
      },
    },
  })

  if (signUpError) {
    return formError(undefined, safeValues, signUpError.message)
  }

  redirect(`/verify?email=${encodeURIComponent(invite.email)}`)
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = {
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), { email: raw.email })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    if (error.code === 'email_not_confirmed') {
      redirect(`/verify?email=${encodeURIComponent(parsed.data.email)}`)
    }
    return formError(undefined, { email: raw.email }, error.message)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function verifyAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = {
    email: String(formData.get('email') ?? ''),
    token: String(formData.get('token') ?? ''),
  }

  const parsed = verifySchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), { email: raw.email })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: 'email',
  })

  if (error) {
    return formError(undefined, { email: raw.email }, error.message)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function resendVerificationAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '')
  if (!email) {
    return formError(undefined, {}, 'Missing email address')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({ type: 'signup', email })

  if (error) {
    return formError(undefined, { email }, error.message)
  }

  return {
    status: 'success',
    message: 'A new code has been sent to your email.',
    values: { email },
  }
}

export async function forgotPasswordAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = { email: String(formData.get('email') ?? '') }

  const parsed = forgotPasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), raw)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email)

  if (error) {
    return formError(undefined, raw, error.message)
  }

  redirect(`/reset-password/verify?email=${encodeURIComponent(parsed.data.email)}`)
}

export async function verifyResetOtpAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = {
    email: String(formData.get('email') ?? ''),
    token: String(formData.get('token') ?? ''),
  }

  const parsed = verifySchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), { email: raw.email })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: 'recovery',
  })

  if (error) {
    return formError(undefined, { email: raw.email }, error.message)
  }

  revalidatePath('/', 'layout')
  redirect('/reset-password')
}

export async function updatePasswordAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = {
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  }

  const parsed = updatePasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), {})
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims) {
    return formError(
      undefined,
      {},
      'Your session has expired. Please request a new code.'
    )
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return formError(undefined, {}, error.message)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// Zod 4 returns issues on `error.issues`. Group them into { fieldName: messages[] }.
function z4FieldErrors(error: {
  issues: { path: PropertyKey[]; message: string }[]
}): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_form')
    if (!result[key]) result[key] = []
    result[key].push(issue.message)
  }
  return result
}
