'use server'

import { randomBytes } from 'crypto'

import { revalidatePath } from 'next/cache'

import { sendInvitationEmail } from '@/lib/email/send-invitation'
import {
  changeRoleSchema,
  inviteSchema,
  invitationIdSchema,
} from '@/lib/schemas/admin'
import { createClient } from '@/lib/supabase/server'

import type { AuthState } from '../(auth)/auth-state'

const INVITATION_TTL_DAYS = 7

function formError(
  fieldErrors: Record<string, string[]> | undefined,
  values: Record<string, string>,
  message?: string
): AuthState {
  return { status: 'error', fieldErrors, values, message }
}

function formSuccess(
  message: string,
  values: Record<string, string> = {}
): AuthState {
  return { status: 'success', message, values }
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const role = (data?.claims as { user_role?: string } | undefined)?.user_role
  if (role !== 'administrator') {
    throw new Error('Only administrators can perform this action.')
  }
  return { supabase, claims: data?.claims }
}

export async function inviteUserAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = {
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    role: String(formData.get('role') ?? ''),
    firstName: String(formData.get('firstName') ?? '').trim(),
    lastName: String(formData.get('lastName') ?? '').trim(),
  }

  const parsed = inviteSchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), raw)
  }

  let supabase
  let claims
  try {
    ({ supabase, claims } = await requireAdmin())
  } catch (err) {
    return formError(undefined, raw, (err as Error).message)
  }

  const token = randomBytes(24).toString('hex')
  const expiresAt = new Date(
    Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  const inviterId = (claims as { sub?: string } | undefined)?.sub
  const firstName = parsed.data.firstName?.trim() || null
  const lastName = parsed.data.lastName?.trim() || null

  const { error: insertError } = await supabase.from('invitations').insert({
    email: parsed.data.email,
    role: parsed.data.role,
    first_name: firstName,
    last_name: lastName,
    invited_by: inviterId,
    token,
    expires_at: expiresAt,
  })

  if (insertError) {
    return formError(undefined, raw, insertError.message)
  }

  const inviterName = (claims as {
    user_metadata?: { first_name?: string; last_name?: string }
  })?.user_metadata
  const inviterDisplay = [
    inviterName?.first_name,
    inviterName?.last_name,
  ]
    .filter(Boolean)
    .join(' ')

  const { error: emailError } = await sendInvitationEmail({
    to: parsed.data.email,
    token,
    role: parsed.data.role,
    firstName,
    invitedByName: inviterDisplay || null,
  })

  if (emailError) {
    return formError(
      undefined,
      raw,
      `Invitation saved, but email failed to send: ${emailError}`
    )
  }

  revalidatePath('/admin/invitations')
  return formSuccess(`Invitation sent to ${parsed.data.email}.`)
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const parsed = invitationIdSchema.safeParse({
    invitationId: String(formData.get('invitationId') ?? ''),
  })
  if (!parsed.success) return

  const { supabase } = await requireAdmin()
  await supabase
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', parsed.data.invitationId)
    .is('accepted_at', null)
    .is('revoked_at', null)

  revalidatePath('/admin/invitations')
}

export async function resendInvitationAction(formData: FormData): Promise<void> {
  const parsed = invitationIdSchema.safeParse({
    invitationId: String(formData.get('invitationId') ?? ''),
  })
  if (!parsed.success) return

  const { supabase, claims } = await requireAdmin()

  const { data: invite } = await supabase
    .from('invitations')
    .select('email, role, first_name, token, accepted_at, revoked_at, expires_at')
    .eq('id', parsed.data.invitationId)
    .maybeSingle()

  if (!invite || invite.accepted_at || invite.revoked_at) return

  // Refresh expiry if the original is in the past.
  let token = invite.token as string
  let expiresAt: string | null = null
  if (new Date(invite.expires_at as string).getTime() <= Date.now()) {
    token = randomBytes(24).toString('hex')
    expiresAt = new Date(
      Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()
    await supabase
      .from('invitations')
      .update({ token, expires_at: expiresAt })
      .eq('id', parsed.data.invitationId)
  }

  const inviterName = (claims as {
    user_metadata?: { first_name?: string; last_name?: string }
  })?.user_metadata
  const inviterDisplay = [
    inviterName?.first_name,
    inviterName?.last_name,
  ]
    .filter(Boolean)
    .join(' ')

  await sendInvitationEmail({
    to: invite.email as string,
    token,
    role: invite.role as 'administrator' | 'requester' | 'supervisor' | 'technician' | 'inspector',
    firstName: invite.first_name as string | null,
    invitedByName: inviterDisplay || null,
  })

  revalidatePath('/admin/invitations')
}

export async function changeUserRoleAction(formData: FormData): Promise<void> {
  const parsed = changeRoleSchema.safeParse({
    userId: String(formData.get('userId') ?? ''),
    role: String(formData.get('role') ?? ''),
  })
  if (!parsed.success) return

  const { supabase, claims } = await requireAdmin()

  // Prevent admins from demoting themselves; would lock them out of the admin UI.
  const selfId = (claims as { sub?: string } | undefined)?.sub
  if (selfId && selfId === parsed.data.userId && parsed.data.role !== 'administrator') {
    return
  }

  await supabase
    .from('user_roles')
    .update({ role: parsed.data.role })
    .eq('user_id', parsed.data.userId)

  revalidatePath('/admin/users')
}

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
