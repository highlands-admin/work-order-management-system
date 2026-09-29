'use server'

import { randomBytes } from 'crypto'

import { revalidatePath } from 'next/cache'

import { sendInvitationEmail } from '@/lib/email/send-invitation'
import {
  addPropertySchema,
  changeRoleSchema,
  inviteSchema,
  invitationIdSchema,
  renamePropertySchema,
  setCategoryApproversSchema,
  setPropertyActiveSchema,
  type SetCategoryApproversInput,
} from '@/lib/schemas/admin'
import { createClient } from '@/lib/supabase/server'
import { propertyKeyFromName } from '@/lib/work-orders/properties'

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
    role: invite.role as 'administrator' | 'requester' | 'technician' | 'inspector',
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

  // Admins cannot change their own role.
  const selfId = (claims as { sub?: string } | undefined)?.sub
  if (selfId && selfId === parsed.data.userId) return

  // Admins cannot change another administrator's role. Mirrored by RLS on user_roles.
  const { data: target } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', parsed.data.userId)
    .maybeSingle()
  if (target?.role === 'administrator') return

  await supabase
    .from('user_roles')
    .update({ role: parsed.data.role })
    .eq('user_id', parsed.data.userId)

  revalidatePath('/admin/users')
}

// Replaces the approver set for one category with the given users. Called
// directly from the approvers page rather than through a form, so it takes
// typed arguments. Returns an error message for the page to show, or null.
export async function setCategoryApproversAction(
  input: SetCategoryApproversInput
): Promise<string | null> {
  const parsed = setCategoryApproversSchema.safeParse(input)
  if (!parsed.success) return 'Invalid approver selection.'

  let supabase
  try {
    ({ supabase } = await requireAdmin())
  } catch (err) {
    return (err as Error).message
  }

  const { category } = parsed.data
  const userIds = [...new Set(parsed.data.userIds)]

  // Only administrators can act on the approval queue, so only they can be
  // approvers. get_category_approvers enforces the same rule at send time.
  if (userIds.length > 0) {
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('user_id', userIds)
      .eq('role', 'administrator')
    if (rolesError) return rolesError.message
    if ((roles ?? []).length !== userIds.length) {
      return 'Approvers must be administrators.'
    }
  }

  // Remove approvers no longer selected, then add the new ones. RLS scopes
  // both statements to the caller's organization, and organization_id is
  // filled by its column default. The upsert ignores rows that already exist,
  // so unchanged approvers keep their created_at.
  let removal = supabase
    .from('category_approvers')
    .delete()
    .eq('category', category)
  if (userIds.length > 0) {
    removal = removal.not('user_id', 'in', `(${userIds.join(',')})`)
  }
  const { error: deleteError } = await removal
  if (deleteError) return deleteError.message

  if (userIds.length > 0) {
    const { error: upsertError } = await supabase
      .from('category_approvers')
      .upsert(
        userIds.map((userId) => ({ category, user_id: userId })),
        {
          onConflict: 'organization_id,category,user_id',
          ignoreDuplicates: true,
        }
      )
    if (upsertError) return upsertError.message
  }

  revalidatePath('/admin/approvers')
  return null
}

// Postgres unique_violation. The only unique constraint a property write can
// hit from here is the per-organization name index.
const UNIQUE_VIOLATION = '23505'
const DUPLICATE_PROPERTY_NAME = 'A property with this name already exists.'

export async function addPropertyAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = { name: String(formData.get('name') ?? '') }
  const parsed = addPropertySchema.safeParse(raw)
  if (!parsed.success) return formError(z4FieldErrors(parsed.error), raw)

  let supabase
  try {
    ({ supabase } = await requireAdmin())
  } catch (err) {
    return formError(undefined, raw, (err as Error).message)
  }

  const baseKey = propertyKeyFromName(parsed.data.name)
  if (!baseKey) {
    return formError({ name: ['Use at least one letter or number'] }, raw)
  }

  // Keys are internal and never change, so a retired property keeps its key
  // and a new one with a similar name gets a numbered suffix instead.
  const { data: existing, error: lookupError } = await supabase
    .from('properties')
    .select('key')
    .like('key', `${baseKey}%`)
  if (lookupError) return formError(undefined, raw, lookupError.message)

  const taken = new Set((existing ?? []).map((row) => row.key as string))
  let key = baseKey
  for (let n = 2; taken.has(key); n++) key = `${baseKey}_${n}`

  const { error } = await supabase
    .from('properties')
    .insert({ key, name: parsed.data.name })
  if (error) {
    return formError(
      error.code === UNIQUE_VIOLATION ? { name: [DUPLICATE_PROPERTY_NAME] } : undefined,
      raw,
      error.code === UNIQUE_VIOLATION ? undefined : error.message
    )
  }

  revalidatePath('/admin/properties')
  return formSuccess(`Added ${parsed.data.name}.`)
}

// Called directly from the properties table rather than through a form, so it
// takes typed arguments. Returns an error message for the row, or null.
export async function renamePropertyAction(input: {
  key: string
  name: string
}): Promise<string | null> {
  const parsed = renamePropertySchema.safeParse(input)
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Invalid name.'
  }

  let supabase
  try {
    ({ supabase } = await requireAdmin())
  } catch (err) {
    return (err as Error).message
  }

  const { error } = await supabase
    .from('properties')
    .update({ name: parsed.data.name })
    .eq('key', parsed.data.key)
  if (error) {
    return error.code === UNIQUE_VIOLATION ? DUPLICATE_PROPERTY_NAME : error.message
  }

  revalidatePath('/admin/properties')
  return null
}

// Retiring hides a property from the work order forms. Existing work orders
// keep it, and it stays available as a filter.
export async function setPropertyActiveAction(input: {
  key: string
  isActive: boolean
}): Promise<string | null> {
  const parsed = setPropertyActiveSchema.safeParse(input)
  if (!parsed.success) return 'Invalid property.'

  let supabase
  try {
    ({ supabase } = await requireAdmin())
  } catch (err) {
    return (err as Error).message
  }

  const { error } = await supabase
    .from('properties')
    .update({ is_active: parsed.data.isActive })
    .eq('key', parsed.data.key)
  if (error) return error.message

  revalidatePath('/admin/properties')
  return null
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
