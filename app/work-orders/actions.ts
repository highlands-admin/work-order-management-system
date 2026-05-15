'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createWorkOrderSchema } from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'

import type { AuthState } from '../(auth)/auth-state'

const FILER_ROLES = ['administrator', 'supervisor', 'requester'] as const

function formError(
  fieldErrors: Record<string, string[]> | undefined,
  values: Record<string, string>,
  message?: string
): AuthState {
  return { status: 'error', fieldErrors, values, message }
}

export async function createWorkOrderAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = {
    category: String(formData.get('category') ?? ''),
    priority: String(formData.get('priority') ?? ''),
    property: String(formData.get('property') ?? ''),
    unitNumber: String(formData.get('unitNumber') ?? ''),
    dueAt: String(formData.get('dueAt') ?? ''),
    description: String(formData.get('description') ?? ''),
    reportedByName: String(formData.get('reportedByName') ?? ''),
    reportedByEmail: String(formData.get('reportedByEmail') ?? ''),
    reportedByPhone: String(formData.get('reportedByPhone') ?? ''),
  }

  const parsed = createWorkOrderSchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), raw)
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as
    | { sub?: string; user_role?: string }
    | undefined

  if (!claims?.sub) {
    return formError(undefined, raw, 'You must be signed in to file a work order.')
  }

  if (!FILER_ROLES.includes(claims.user_role as (typeof FILER_ROLES)[number])) {
    return formError(
      undefined,
      raw,
      'Your role is not permitted to create work orders.'
    )
  }

  const { error } = await supabase.from('work_orders').insert({
    category: parsed.data.category,
    priority: parsed.data.priority,
    property: parsed.data.property,
    unit_number: parsed.data.unitNumber ?? null,
    due_at: parsed.data.dueAt ?? null,
    description: parsed.data.description,
    reported_by_name: parsed.data.reportedByName ?? null,
    reported_by_email: parsed.data.reportedByEmail ?? null,
    reported_by_phone: parsed.data.reportedByPhone ?? null,
    created_by: claims.sub,
    updated_by: claims.sub,
  })

  if (error) {
    return formError(undefined, raw, error.message)
  }

  revalidatePath('/work-orders')
  redirect('/work-orders')
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
