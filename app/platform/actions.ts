'use server'

import { randomBytes } from 'crypto'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import * as z from 'zod'

import type { AuthState } from '@/app/(auth)/auth-state'
import { sendInvitationEmail } from '@/lib/email/send-invitation'
import { formError, formSuccess, z4FieldErrors } from '@/lib/forms/form-state'
import {
  createOrganizationSchema,
  inviteOrganizationAdminSchema,
  slugFromName,
  updateOrganizationSchema,
} from '@/lib/schemas/platform'
import {
  addPropertySchema,
  renamePropertySchema,
  setPropertyActiveSchema,
} from '@/lib/schemas/admin'
import { createClient } from '@/lib/supabase/server'
import {
  nextAvailablePropertyKey,
  propertyKeyFromName,
} from '@/lib/work-orders/properties'

const INVITATION_TTL_DAYS = 7
const UNIQUE_VIOLATION = '23505'

// Every platform_* database function checks super admin status itself. This
// check runs first so a non-admin gets a clear message instead of a database
// error, and so no email is sent on behalf of someone who is not allowed.
async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as
    | {
        sub?: string
        user_metadata?: { first_name?: string; last_name?: string }
      }
    | undefined
  if (!claims?.sub) throw new Error('Sign in to continue.')

  const { data: isSuperAdmin } = await supabase.rpc('is_super_admin')
  if (isSuperAdmin !== true) {
    throw new Error('Only platform admins can perform this action.')
  }

  const inviterName = [
    claims.user_metadata?.first_name,
    claims.user_metadata?.last_name,
  ]
    .filter(Boolean)
    .join(' ')

  return { supabase, inviterName: inviterName || null }
}

// Creates the invitation row and sends the email. Returns an error message,
// or null on success.
async function inviteAdministrator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    organizationId: string
    email: string
    firstName: string | null
    lastName: string | null
    inviterName: string | null
  }
): Promise<string | null> {
  const token = randomBytes(24).toString('hex')
  const expiresAt = new Date(
    Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  const { error } = await supabase.rpc('platform_invite_admin', {
    p_organization_id: input.organizationId,
    p_email: input.email,
    p_first_name: input.firstName ?? '',
    p_last_name: input.lastName ?? '',
    p_token: token,
    p_expires_at: expiresAt,
  })
  if (error) return error.message

  const { error: emailError } = await sendInvitationEmail({
    to: input.email,
    token,
    role: 'administrator',
    firstName: input.firstName,
    invitedByName: input.inviterName,
  })
  if (emailError) {
    return `Invitation saved, but the email failed to send: ${emailError}`
  }

  return null
}

export async function createOrganizationAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    domain: String(formData.get('domain') ?? ''),
    adminEmail: String(formData.get('adminEmail') ?? '').trim().toLowerCase(),
    adminFirstName: String(formData.get('adminFirstName') ?? ''),
    adminLastName: String(formData.get('adminLastName') ?? ''),
  }
  const parsed = createOrganizationSchema.safeParse(raw)
  if (!parsed.success) return formError(z4FieldErrors(parsed.error), raw)

  let context
  try {
    context = await requireSuperAdmin()
  } catch (err) {
    return formError(undefined, raw, (err as Error).message)
  }
  const { supabase, inviterName } = context

  const baseSlug = slugFromName(parsed.data.name)
  if (!baseSlug) {
    return formError({ name: ['Use at least one letter or number'] }, raw)
  }

  const { data: existing, error: listError } = await supabase.rpc(
    'platform_list_organizations'
  )
  if (listError) return formError(undefined, raw, listError.message)

  const takenSlugs = new Set(
    ((existing ?? []) as { slug: string }[]).map((org) => org.slug)
  )
  let slug = baseSlug
  for (let n = 2; takenSlugs.has(slug); n++) slug = `${baseSlug}-${n}`

  const { data: organizationId, error: createError } = await supabase.rpc(
    'platform_create_organization',
    { p_name: parsed.data.name, p_slug: slug, p_domain: parsed.data.domain }
  )
  if (createError) {
    return formError(
      createError.code === UNIQUE_VIOLATION
        ? { domain: ['Another organization already uses this domain'] }
        : undefined,
      raw,
      createError.code === UNIQUE_VIOLATION ? undefined : createError.message
    )
  }

  const inviteError = await inviteAdministrator(supabase, {
    organizationId: organizationId as string,
    email: parsed.data.adminEmail,
    firstName: parsed.data.adminFirstName || null,
    lastName: parsed.data.adminLastName || null,
    inviterName,
  })

  revalidatePath('/platform')
  if (inviteError) {
    // The organization exists at this point, so send the admin to its page,
    // where the invitation can be retried.
    return formError(
      undefined,
      raw,
      `Created ${parsed.data.name}, but the administrator invitation failed: ${inviteError}`
    )
  }

  redirect(`/platform/${organizationId as string}`)
}

export async function updateOrganizationAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = {
    organizationId: String(formData.get('organizationId') ?? ''),
    name: String(formData.get('name') ?? ''),
    domain: String(formData.get('domain') ?? ''),
  }
  const parsed = updateOrganizationSchema.safeParse(raw)
  if (!parsed.success) return formError(z4FieldErrors(parsed.error), raw)

  let supabase
  try {
    ({ supabase } = await requireSuperAdmin())
  } catch (err) {
    return formError(undefined, raw, (err as Error).message)
  }

  const { error } = await supabase.rpc('platform_update_organization', {
    p_id: parsed.data.organizationId,
    p_name: parsed.data.name,
    p_domain: parsed.data.domain,
  })
  if (error) {
    return formError(
      error.code === UNIQUE_VIOLATION
        ? { domain: ['Another organization already uses this domain'] }
        : undefined,
      raw,
      error.code === UNIQUE_VIOLATION ? undefined : error.message
    )
  }

  revalidatePath('/platform')
  revalidatePath(`/platform/${parsed.data.organizationId}`)
  return formSuccess('Saved.', raw)
}

export async function inviteOrganizationAdminAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = {
    organizationId: String(formData.get('organizationId') ?? ''),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
  }
  const parsed = inviteOrganizationAdminSchema.safeParse(raw)
  if (!parsed.success) return formError(z4FieldErrors(parsed.error), raw)

  let context
  try {
    context = await requireSuperAdmin()
  } catch (err) {
    return formError(undefined, raw, (err as Error).message)
  }

  const inviteError = await inviteAdministrator(context.supabase, {
    organizationId: parsed.data.organizationId,
    email: parsed.data.email,
    firstName: parsed.data.firstName || null,
    lastName: parsed.data.lastName || null,
    inviterName: context.inviterName,
  })
  if (inviteError) return formError(undefined, raw, inviteError)

  revalidatePath('/platform')
  revalidatePath(`/platform/${parsed.data.organizationId}`)
  return formSuccess(`Invitation sent to ${parsed.data.email}.`)
}

// The property actions below are bound to an organization id on the page
// (action.bind(null, organizationId)), so they plug into the same components
// as the organization admin's own property actions. Bound arguments travel
// through the browser, so the id is validated like any other input.
const organizationIdSchema = z.uuid()

export async function platformAddPropertyAction(
  organizationId: string,
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = { name: String(formData.get('name') ?? '') }
  if (!organizationIdSchema.safeParse(organizationId).success) {
    return formError(undefined, raw, 'Invalid organization.')
  }
  const parsed = addPropertySchema.safeParse(raw)
  if (!parsed.success) return formError(z4FieldErrors(parsed.error), raw)

  let supabase
  try {
    ({ supabase } = await requireSuperAdmin())
  } catch (err) {
    return formError(undefined, raw, (err as Error).message)
  }

  const baseKey = propertyKeyFromName(parsed.data.name)
  if (!baseKey) {
    return formError({ name: ['Use at least one letter or number'] }, raw)
  }

  const { data: existing, error: listError } = await supabase.rpc(
    'platform_list_properties',
    { p_organization_id: organizationId }
  )
  if (listError) return formError(undefined, raw, listError.message)

  const key = nextAvailablePropertyKey(
    baseKey,
    ((existing ?? []) as { key: string }[]).map((row) => row.key)
  )

  const { error } = await supabase.rpc('platform_add_property', {
    p_organization_id: organizationId,
    p_key: key,
    p_name: parsed.data.name,
  })
  if (error) {
    return formError(
      error.code === UNIQUE_VIOLATION
        ? { name: ['A property with this name already exists.'] }
        : undefined,
      raw,
      error.code === UNIQUE_VIOLATION ? undefined : error.message
    )
  }

  revalidatePath(`/platform/${organizationId}`)
  return formSuccess(`Added ${parsed.data.name}.`)
}

export async function platformRenamePropertyAction(
  organizationId: string,
  input: { key: string; name: string }
): Promise<string | null> {
  if (!organizationIdSchema.safeParse(organizationId).success) {
    return 'Invalid organization.'
  }
  const parsed = renamePropertySchema.safeParse(input)
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Invalid name.'
  }

  let supabase
  try {
    ({ supabase } = await requireSuperAdmin())
  } catch (err) {
    return (err as Error).message
  }

  const { error } = await supabase.rpc('platform_update_property', {
    p_organization_id: organizationId,
    p_key: parsed.data.key,
    p_name: parsed.data.name,
    p_is_active: null,
  })
  if (error) {
    return error.code === UNIQUE_VIOLATION
      ? 'A property with this name already exists.'
      : error.message
  }

  revalidatePath(`/platform/${organizationId}`)
  return null
}

export async function platformSetPropertyActiveAction(
  organizationId: string,
  input: { key: string; isActive: boolean }
): Promise<string | null> {
  if (!organizationIdSchema.safeParse(organizationId).success) {
    return 'Invalid organization.'
  }
  const parsed = setPropertyActiveSchema.safeParse(input)
  if (!parsed.success) return 'Invalid property.'

  let supabase
  try {
    ({ supabase } = await requireSuperAdmin())
  } catch (err) {
    return (err as Error).message
  }

  const { error } = await supabase.rpc('platform_update_property', {
    p_organization_id: organizationId,
    p_key: parsed.data.key,
    p_name: null,
    p_is_active: parsed.data.isActive,
  })
  if (error) return error.message

  revalidatePath(`/platform/${organizationId}`)
  return null
}
