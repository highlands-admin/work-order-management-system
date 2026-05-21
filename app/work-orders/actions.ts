'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  APPROVAL_REQUIRED_ROLES,
  createWorkOrderSchema,
  rejectWorkOrderSchema,
  transitionStatusSchema,
  updateWorkOrderSchema,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'

import type { AuthState } from '../(auth)/auth-state'

const FILER_ROLES = ['administrator', 'requester'] as const
const EDITOR_ROLES = ['administrator', 'requester'] as const

type EditorRole = (typeof EDITOR_ROLES)[number]

// What status changes each restricted role is allowed to make.
const TECHNICIAN_TRANSITIONS: Record<string, WorkOrderStatus> = {
  assigned: 'in_progress',
  in_progress: 'done',
}
const INSPECTOR_TRANSITIONS: Record<string, WorkOrderStatus> = {
  done: 'closed',
}

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
    assignedTo: String(formData.get('assignedTo') ?? ''),
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

  // Requester submissions enter the approval queue; admins create approved
  // work orders directly. RLS independently enforces the same mapping, so a
  // tampered request cannot skip approval.
  const initialStatus: WorkOrderStatus = APPROVAL_REQUIRED_ROLES.has(
    claims.user_role as 'requester'
  )
    ? 'pending'
    : 'open'

  const { error } = await supabase.from('work_orders').insert({
    category: parsed.data.category,
    priority: parsed.data.priority,
    property: parsed.data.property ?? null,
    unit_number: parsed.data.unitNumber ?? null,
    due_at: parsed.data.dueAt ?? null,
    description: parsed.data.description,
    reported_by_name: parsed.data.reportedByName ?? null,
    reported_by_email: parsed.data.reportedByEmail ?? null,
    reported_by_phone: parsed.data.reportedByPhone ?? null,
    status: initialStatus,
    assigned_to: parsed.data.assignedTo,
    created_by: claims.sub,
    updated_by: claims.sub,
  })

  if (error) {
    return formError(undefined, raw, error.message)
  }

  revalidatePath('/work-orders')
  redirect('/work-orders')
}

// Full edit for administrators and requesters. RLS and the
// column-immutability trigger enforce the same boundary in the database.
export async function updateWorkOrderAction(
  workOrderId: string,
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
    assignedTo: String(formData.get('assignedTo') ?? ''),
    reportedByName: String(formData.get('reportedByName') ?? ''),
    reportedByEmail: String(formData.get('reportedByEmail') ?? ''),
    reportedByPhone: String(formData.get('reportedByPhone') ?? ''),
    status: String(formData.get('status') ?? ''),
    resolution: String(formData.get('resolution') ?? ''),
  }

  const parsed = updateWorkOrderSchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), raw)
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as
    | { sub?: string; user_role?: string }
    | undefined

  if (!claims?.sub) {
    return formError(undefined, raw, 'You must be signed in to edit a work order.')
  }

  if (!EDITOR_ROLES.includes(claims.user_role as EditorRole)) {
    return formError(
      undefined,
      raw,
      'Your role is not permitted to edit work orders.'
    )
  }

  const { error } = await supabase
    .from('work_orders')
    .update({
      category: parsed.data.category,
      priority: parsed.data.priority,
      property: parsed.data.property ?? null,
      unit_number: parsed.data.unitNumber ?? null,
      due_at: parsed.data.dueAt ?? null,
      description: parsed.data.description,
      reported_by_name: parsed.data.reportedByName ?? null,
      reported_by_email: parsed.data.reportedByEmail ?? null,
      reported_by_phone: parsed.data.reportedByPhone ?? null,
      status: parsed.data.status,
      resolution: parsed.data.resolution ?? null,
      assigned_to: parsed.data.assignedTo,
      updated_by: claims.sub,
    })
    .eq('id', workOrderId)

  if (error) {
    return formError(undefined, raw, error.message)
  }

  revalidatePath('/work-orders')
  revalidatePath(`/work-orders/${workOrderId}/edit`)
  redirect('/work-orders')
}

// Status-only update for technicians (assigned -> in_progress -> done) and
// inspectors (done -> closed). The action picks the target status from the
// caller's role plus the work order's current status, so the form only needs
// to submit a single action without selecting a target.
export async function transitionWorkOrderStatusAction(
  workOrderId: string,
  currentStatus: WorkOrderStatus,
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = { status: String(formData.get('status') ?? '') }
  const parsed = transitionStatusSchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), raw)
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as
    | { sub?: string; user_role?: string }
    | undefined

  if (!claims?.sub) {
    return formError(undefined, raw, 'You must be signed in to update a work order.')
  }

  const role = claims.user_role
  const allowed =
    role === 'technician'
      ? TECHNICIAN_TRANSITIONS[currentStatus]
      : role === 'inspector'
        ? INSPECTOR_TRANSITIONS[currentStatus]
        : undefined

  if (!allowed) {
    return formError(
      undefined,
      raw,
      'Your role cannot change this work order from its current status.'
    )
  }

  if (allowed !== parsed.data.status) {
    return formError(
      undefined,
      raw,
      `Your role can only move this work order to "${allowed}".`
    )
  }

  const { error } = await supabase
    .from('work_orders')
    .update({
      status: parsed.data.status,
      updated_by: claims.sub,
    })
    .eq('id', workOrderId)

  if (error) {
    return formError(undefined, raw, error.message)
  }

  revalidatePath('/work-orders')
  revalidatePath(`/work-orders/${workOrderId}/edit`)
  redirect('/work-orders')
}

// Admin-only: move a pending work order into the live workflow. Clears
// any prior rejection metadata in case the row was previously rejected
// and is being resurrected.
export async function approveWorkOrderAction(
  workOrderId: string,
  _prev: AuthState,
  _formData: FormData
): Promise<AuthState> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as
    | { sub?: string; user_role?: string }
    | undefined

  if (!claims?.sub) {
    return formError(undefined, {}, 'You must be signed in to approve.')
  }
  if (claims.user_role !== 'administrator') {
    return formError(undefined, {}, 'Only administrators can approve work orders.')
  }

  const { error } = await supabase
    .from('work_orders')
    .update({
      status: 'open',
      rejected_reason: null,
      rejected_at: null,
      rejected_by: null,
      updated_by: claims.sub,
    })
    .eq('id', workOrderId)

  if (error) {
    return formError(undefined, {}, error.message)
  }

  revalidatePath('/work-orders/submissions')
  revalidatePath('/work-orders')
  return { status: 'success', message: 'Approved.' }
}

export async function rejectWorkOrderAction(
  workOrderId: string,
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = { reason: String(formData.get('reason') ?? '') }
  const parsed = rejectWorkOrderSchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), raw)
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as
    | { sub?: string; user_role?: string }
    | undefined

  if (!claims?.sub) {
    return formError(undefined, raw, 'You must be signed in to reject.')
  }
  if (claims.user_role !== 'administrator') {
    return formError(undefined, raw, 'Only administrators can reject work orders.')
  }

  const { error } = await supabase
    .from('work_orders')
    .update({
      status: 'rejected',
      rejected_reason: parsed.data.reason,
      rejected_at: new Date().toISOString(),
      rejected_by: claims.sub,
      updated_by: claims.sub,
    })
    .eq('id', workOrderId)

  if (error) {
    return formError(undefined, raw, error.message)
  }

  revalidatePath('/work-orders/submissions')
  revalidatePath('/work-orders')
  return { status: 'success', message: 'Rejected.' }
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
