'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

import type { AuthState } from '../(auth)/auth-state'

const NAME_MAX = 80

export async function updateProfileAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const firstName = String(formData.get('firstName') ?? '').trim()
  const lastName = String(formData.get('lastName') ?? '').trim()

  const values = { firstName, lastName }
  const fieldErrors: Record<string, string[]> = {}
  if (!firstName) {
    fieldErrors.firstName = ['First name is required.']
  } else if (firstName.length > NAME_MAX) {
    fieldErrors.firstName = [`First name must be ${NAME_MAX} characters or fewer.`]
  }
  if (lastName.length > NAME_MAX) {
    fieldErrors.lastName = [`Last name must be ${NAME_MAX} characters or fewer.`]
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', fieldErrors, values }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      status: 'error',
      message: 'Your session has expired. Please sign in again.',
      values,
    }
  }

  // Display name lives in auth metadata; updating it here does not trigger any
  // email confirmation the way an email or password change would.
  const { error: nameError } = await supabase.auth.updateUser({
    data: { first_name: firstName, last_name: lastName },
  })
  if (nameError) {
    return { status: 'error', message: nameError.message, values }
  }

  revalidatePath('/profile')
  return { status: 'success', message: 'Profile updated.', values }
}
