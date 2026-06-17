'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { sendApprovalRequestEmail } from '@/lib/email/send-approval-request-notification'
import {
  sendWorkOrderAssignmentEmail,
  type AssignmentWorkOrder,
} from '@/lib/email/send-assignment-notification'
import {
  APPROVAL_REQUIRED_ROLES,
  DEFAULT_REMINDER_LEAD_DAYS,
  MAIN_TABLE_STATUSES,
  addWorkOrderNoteSchema,
  changeStatusSchema,
  createWorkOrderSchema,
  rejectWorkOrderSchema,
  transitionStatusSchema,
  updateWorkOrderSchema,
  type WorkOrderCategory,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'
import { fetchAssignableUsers } from '@/lib/work-orders/assignable-users'
import { getCategoryApprover } from '@/lib/work-orders/category-approvers'
import { nextOccurrenceAfter } from '@/lib/work-orders/recurrence'

import type { AuthState } from '../(auth)/auth-state'

type ActorClaims = {
  sub?: string
  user_role?: string
  email?: string
  user_metadata?: { first_name?: string; last_name?: string }
}

// Display name for the person performing the action, for the "assigned by" line.
function actorName(claims: ActorClaims | undefined): string | null {
  const name = [claims?.user_metadata?.first_name, claims?.user_metadata?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
  return name || claims?.email || null
}

// Emails the assignee that a work order is now theirs. Never throws: a failed
// notification must not fail the work order create/update it follows.
async function notifyAssignee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assigneeId: string,
  assignedByName: string | null,
  workOrder: AssignmentWorkOrder
): Promise<void> {
  try {
    const users = await fetchAssignableUsers(supabase)
    const assignee = users.find((u) => u.user_id === assigneeId)
    if (!assignee?.email) return
    await sendWorkOrderAssignmentEmail({
      to: assignee.email,
      assigneeFirstName: assignee.first_name,
      assignedByName,
      workOrder,
    })
  } catch (error) {
    console.error('Failed to send assignment notification', error)
  }
}

// Emails the category's designated approver that a work order is waiting in the
// approval queue. Never throws: a failed notification must not fail the work
// order creation it follows. No-ops for categories without a configured
// approver.
async function notifyCategoryApprover(
  category: WorkOrderCategory,
  submittedByName: string | null,
  workOrder: AssignmentWorkOrder
): Promise<void> {
  try {
    const approver = getCategoryApprover(category)
    if (!approver) return
    await sendApprovalRequestEmail({
      to: approver.email,
      approverName: approver.name,
      submittedByName,
      workOrder,
    })
  } catch (error) {
    console.error('Failed to send approval request notification', error)
  }
}

const FILER_ROLES = ['administrator', 'requester'] as const
const EDITOR_ROLES = ['administrator', 'requester'] as const

type EditorRole = (typeof EDITOR_ROLES)[number]

// What status changes each restricted role is allowed to make.
const TECHNICIAN_TRANSITIONS: Record<string, WorkOrderStatus> = {
  open: 'in_progress',
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
  const marketingTargetAudience = formData
    .getAll('marketingTargetAudience')
    .map((v) => String(v))
  const marketingSizeFormat = formData
    .getAll('marketingSizeFormat')
    .map((v) => String(v))
  const raw = {
    title: String(formData.get('title') ?? ''),
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
    provider: String(formData.get('provider') ?? ''),
    frequency: String(formData.get('frequency') ?? ''),
    reminderLeadDays: String(formData.get('reminderLeadDays') ?? ''),
    marketingRequestType: String(formData.get('marketingRequestType') ?? ''),
    marketingRequestTypeOther: String(
      formData.get('marketingRequestTypeOther') ?? ''
    ),
    marketingEventName: String(formData.get('marketingEventName') ?? ''),
    marketingTargetAudience,
    marketingTargetAudienceOther: String(
      formData.get('marketingTargetAudienceOther') ?? ''
    ),
    marketingKeyMessage: String(formData.get('marketingKeyMessage') ?? ''),
    marketingSizeFormat,
    marketingSizeFormatOther: String(
      formData.get('marketingSizeFormatOther') ?? ''
    ),
  }
  // AuthState.values is a flat string map, so the multi-selects are echoed back
  // as comma-joined strings for the form to re-hydrate on validation errors.
  const values = {
    ...raw,
    marketingTargetAudience: marketingTargetAudience.join(','),
    marketingSizeFormat: marketingSizeFormat.join(','),
  }

  const parsed = createWorkOrderSchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), values)
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as ActorClaims | undefined

  if (!claims?.sub) {
    return formError(undefined, values, 'You must be signed in to file a work order.')
  }

  if (!FILER_ROLES.includes(claims.user_role as (typeof FILER_ROLES)[number])) {
    return formError(
      undefined,
      values,
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

  // When a frequency is set, the work order is filed as a recurring order: create
  // the template first, then file its first occurrence below, linked to it. The
  // template's next_due_at points at the second occurrence, which pg_cron will
  // generate; later occurrences advance from there. one_time has no second
  // occurrence, so the template is created already inactive.
  let recurringWorkOrderId: string | null = null
  if (parsed.data.frequency && parsed.data.dueAt) {
    const { data: template, error: templateError } = await supabase
      .from('recurring_work_orders')
      .insert({
        title: parsed.data.title,
        category: parsed.data.category,
        priority: parsed.data.priority,
        property: parsed.data.property ?? null,
        unit_number: parsed.data.unitNumber ?? null,
        description: parsed.data.description,
        provider: parsed.data.provider ?? null,
        assigned_to: parsed.data.assignedTo ?? null,
        frequency: parsed.data.frequency,
        anchor_date: parsed.data.dueAt.slice(0, 10),
        next_due_at: nextOccurrenceAfter(
          parsed.data.dueAt,
          parsed.data.frequency
        ),
        reminder_lead_days:
          parsed.data.reminderLeadDays ?? DEFAULT_REMINDER_LEAD_DAYS,
        active: parsed.data.frequency !== 'one_time',
        created_by: claims.sub,
        updated_by: claims.sub,
      })
      .select('id')
      .single()

    if (templateError) {
      return formError(undefined, values, templateError.message)
    }
    recurringWorkOrderId = template.id
  }

  const { data: workOrderData, error } = await supabase
    .from('work_orders')
    .insert({
      title: parsed.data.title,
      category: parsed.data.category,
      priority: parsed.data.priority,
      property: parsed.data.property ?? null,
      unit_number: parsed.data.unitNumber ?? null,
      due_at: parsed.data.dueAt ?? null,
      description: parsed.data.description,
      provider: parsed.data.provider ?? null,
      recurring_work_order_id: recurringWorkOrderId,
      reported_by_name: parsed.data.reportedByName ?? null,
      reported_by_email: parsed.data.reportedByEmail ?? null,
      reported_by_phone: parsed.data.reportedByPhone ?? null,
      marketing_request_type: parsed.data.marketingRequestType ?? null,
      marketing_request_type_other:
        parsed.data.marketingRequestTypeOther ?? null,
      marketing_event_name: parsed.data.marketingEventName ?? null,
      marketing_target_audience: parsed.data.marketingTargetAudience ?? null,
      marketing_target_audience_other:
        parsed.data.marketingTargetAudienceOther ?? null,
      marketing_key_message: parsed.data.marketingKeyMessage ?? null,
      marketing_size_format: parsed.data.marketingSizeFormat ?? null,
      marketing_size_format_other: parsed.data.marketingSizeFormatOther ?? null,
      status: initialStatus,
      assigned_to: parsed.data.assignedTo ?? null,
      created_by: claims.sub,
      updated_by: claims.sub,
    })
    .select('id, work_order_code')
    .single()

  if (error) {
    return formError(undefined, values, error.message)
  }

  // Insert any notes submitted alongside the form. Notes are optional and
  // their failure must not block the work order creation, so errors are
  // silently ignored here.
  const noteValues = formData
    .getAll('note')
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0 && v.length <= 2000)

  if (noteValues.length > 0) {
    await supabase.from('work_order_notes').insert(
      noteValues.map((body) => ({
        work_order_id: workOrderData.id,
        body,
        created_by: claims.sub,
      }))
    )
  }

  const notificationWorkOrder: AssignmentWorkOrder = {
    id: workOrderData.id,
    code: workOrderData.work_order_code,
    title: parsed.data.title,
    category: parsed.data.category,
    priority: parsed.data.priority,
    status: initialStatus,
    property: parsed.data.property ?? null,
    unitNumber: parsed.data.unitNumber ?? null,
    dueAt: parsed.data.dueAt ?? null,
    description: parsed.data.description,
    reporterName: parsed.data.reportedByName ?? null,
    reporterEmail: parsed.data.reportedByEmail ?? null,
  }

  // Notify the assignee (unless they assigned it to themselves).
  if (parsed.data.assignedTo && parsed.data.assignedTo !== claims.sub) {
    await notifyAssignee(
      supabase,
      parsed.data.assignedTo,
      actorName(claims),
      notificationWorkOrder
    )
  }

  // A submission that needs approval pings the category's approver.
  if (initialStatus === 'pending') {
    await notifyCategoryApprover(
      parsed.data.category,
      actorName(claims),
      notificationWorkOrder
    )
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
  const marketingTargetAudience = formData
    .getAll('marketingTargetAudience')
    .map((v) => String(v))
  const marketingSizeFormat = formData
    .getAll('marketingSizeFormat')
    .map((v) => String(v))
  const raw = {
    title: String(formData.get('title') ?? ''),
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
    provider: String(formData.get('provider') ?? ''),
    status: String(formData.get('status') ?? ''),
    resolution: String(formData.get('resolution') ?? ''),
    marketingRequestType: String(formData.get('marketingRequestType') ?? ''),
    marketingRequestTypeOther: String(
      formData.get('marketingRequestTypeOther') ?? ''
    ),
    marketingEventName: String(formData.get('marketingEventName') ?? ''),
    marketingTargetAudience,
    marketingTargetAudienceOther: String(
      formData.get('marketingTargetAudienceOther') ?? ''
    ),
    marketingKeyMessage: String(formData.get('marketingKeyMessage') ?? ''),
    marketingSizeFormat,
    marketingSizeFormatOther: String(
      formData.get('marketingSizeFormatOther') ?? ''
    ),
  }
  const values = {
    ...raw,
    marketingTargetAudience: marketingTargetAudience.join(','),
    marketingSizeFormat: marketingSizeFormat.join(','),
  }

  const parsed = updateWorkOrderSchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), values)
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as ActorClaims | undefined

  if (!claims?.sub) {
    return formError(undefined, values, 'You must be signed in to edit a work order.')
  }

  if (!EDITOR_ROLES.includes(claims.user_role as EditorRole)) {
    return formError(
      undefined,
      values,
      'Your role is not permitted to edit work orders.'
    )
  }

  // Read the current creator/assignee (and code) first so we can authorize the
  // edit and tell whether it reassigns the work order before notifying.
  const { data: existing } = await supabase
    .from('work_orders')
    .select('created_by, assigned_to, work_order_code')
    .eq('id', workOrderId)
    .maybeSingle<{
      created_by: string
      assigned_to: string | null
      work_order_code: string
    }>()

  if (!existing) {
    return formError(undefined, values, 'Work order not found.')
  }

  // Requesters may only edit work orders they created or are assigned to;
  // administrators may edit any. RLS enforces this independently, but checking
  // here returns a clear error instead of a silent no-op update.
  if (
    claims.user_role === 'requester' &&
    existing.created_by !== claims.sub &&
    existing.assigned_to !== claims.sub
  ) {
    return formError(
      undefined,
      values,
      'You can only edit work orders you created or are assigned to.'
    )
  }

  const { error } = await supabase
    .from('work_orders')
    .update({
      title: parsed.data.title,
      category: parsed.data.category,
      priority: parsed.data.priority,
      property: parsed.data.property ?? null,
      unit_number: parsed.data.unitNumber ?? null,
      due_at: parsed.data.dueAt ?? null,
      description: parsed.data.description,
      provider: parsed.data.provider ?? null,
      reported_by_name: parsed.data.reportedByName ?? null,
      reported_by_email: parsed.data.reportedByEmail ?? null,
      reported_by_phone: parsed.data.reportedByPhone ?? null,
      status: parsed.data.status,
      resolution: parsed.data.resolution ?? null,
      marketing_request_type: parsed.data.marketingRequestType ?? null,
      marketing_request_type_other:
        parsed.data.marketingRequestTypeOther ?? null,
      marketing_event_name: parsed.data.marketingEventName ?? null,
      marketing_target_audience: parsed.data.marketingTargetAudience ?? null,
      marketing_target_audience_other:
        parsed.data.marketingTargetAudienceOther ?? null,
      marketing_key_message: parsed.data.marketingKeyMessage ?? null,
      marketing_size_format: parsed.data.marketingSizeFormat ?? null,
      marketing_size_format_other: parsed.data.marketingSizeFormatOther ?? null,
      assigned_to: parsed.data.assignedTo ?? null,
      updated_by: claims.sub,
    })
    .eq('id', workOrderId)

  if (error) {
    return formError(undefined, values, error.message)
  }

  // Notify the assignee only when the assignee actually changed to someone new
  // (and not the editor themselves).
  const newAssignee = parsed.data.assignedTo
  if (
    newAssignee &&
    newAssignee !== existing?.assigned_to &&
    newAssignee !== claims.sub
  ) {
    await notifyAssignee(supabase, newAssignee, actorName(claims), {
      id: workOrderId,
      code: existing?.work_order_code ?? '',
      title: parsed.data.title,
      category: parsed.data.category,
      priority: parsed.data.priority,
      status: parsed.data.status,
      property: parsed.data.property ?? null,
      unitNumber: parsed.data.unitNumber ?? null,
      dueAt: parsed.data.dueAt ?? null,
      description: parsed.data.description,
      reporterName: parsed.data.reportedByName ?? null,
      reporterEmail: parsed.data.reportedByEmail ?? null,
    })
  }

  revalidatePath('/work-orders')
  revalidatePath(`/work-orders/${workOrderId}/edit`)
  redirect('/work-orders')
}

// Status-only update for technicians (open -> in_progress -> done) and
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

// Inline status change from the work order detail page. Available to admins,
// the assignee, and the creator, who may move an approved work order freely
// between the main workflow statuses. RLS and the column trigger enforce the
// same rules in the database. Returns a result object (no redirect) so the
// detail page control can update in place.
export async function changeWorkOrderStatusAction(
  workOrderId: string,
  status: string
): Promise<{ status: 'success' | 'error'; message?: string }> {
  const parsed = changeStatusSchema.safeParse({ status })
  if (!parsed.success) {
    return { status: 'error', message: 'Choose a valid status.' }
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as ActorClaims | undefined

  if (!claims?.sub) {
    return { status: 'error', message: 'You must be signed in.' }
  }

  const { data: existing } = await supabase
    .from('work_orders')
    .select('created_by, assigned_to, status')
    .eq('id', workOrderId)
    .maybeSingle<{
      created_by: string
      assigned_to: string | null
      status: WorkOrderStatus
    }>()

  if (!existing) {
    return { status: 'error', message: 'Work order not found.' }
  }

  const canChange =
    claims.user_role === 'administrator' ||
    existing.created_by === claims.sub ||
    existing.assigned_to === claims.sub
  if (!canChange) {
    return {
      status: 'error',
      message: 'You are not permitted to change this work order’s status.',
    }
  }

  // Pending and rejected work orders move through the approval flow, not here.
  if (!(MAIN_TABLE_STATUSES as readonly WorkOrderStatus[]).includes(existing.status)) {
    return {
      status: 'error',
      message: 'This work order is not in the active workflow.',
    }
  }

  const { error } = await supabase
    .from('work_orders')
    .update({ status: parsed.data.status, updated_by: claims.sub })
    .eq('id', workOrderId)

  if (error) {
    return { status: 'error', message: error.message }
  }

  revalidatePath('/work-orders')
  revalidatePath('/work-orders/mine')
  revalidatePath(`/work-orders/${workOrderId}`)
  revalidatePath(`/work-orders/${workOrderId}/edit`)
  return { status: 'success' }
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
  revalidatePath(`/work-orders/${workOrderId}`)
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

// Adds a single note to an existing work order. Any authenticated user may
// call this. The action does not redirect so the compose box stays visible.
export async function addWorkOrderNoteAction(
  workOrderId: string,
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = { body: String(formData.get('body') ?? '') }
  const parsed = addWorkOrderNoteSchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), raw)
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as
    | { sub?: string; user_role?: string }
    | undefined

  if (!claims?.sub) {
    return formError(undefined, raw, 'You must be signed in to add a note.')
  }

  const { error } = await supabase.from('work_order_notes').insert({
    work_order_id: workOrderId,
    body: parsed.data.body,
    created_by: claims.sub,
  })

  if (error) {
    return formError(undefined, raw, error.message)
  }

  revalidatePath(`/work-orders/${workOrderId}`)
  revalidatePath(`/work-orders/${workOrderId}/edit`)
  return { status: 'success', message: 'Note added.' }
}

// Edits a note's body. RLS restricts this to the note's author, and a trigger
// keeps every other column immutable, so only the text can change.
export async function updateWorkOrderNoteAction(
  noteId: string,
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = { body: String(formData.get('body') ?? '') }
  const parsed = addWorkOrderNoteSchema.safeParse(raw)
  if (!parsed.success) {
    return formError(z4FieldErrors(parsed.error), raw)
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as { sub?: string } | undefined

  if (!claims?.sub) {
    return formError(undefined, raw, 'You must be signed in to edit a note.')
  }

  const { data, error } = await supabase
    .from('work_order_notes')
    .update({ body: parsed.data.body })
    .eq('id', noteId)
    .select('work_order_id')
    .single()

  if (error) {
    return formError(undefined, raw, error.message)
  }

  revalidatePath(`/work-orders/${data.work_order_id}`)
  return { status: 'success', message: 'Note updated.' }
}

// Deletes a note. RLS restricts this to the note's author or an administrator.
export async function deleteWorkOrderNoteAction(
  noteId: string,
  _prev: AuthState,
  _formData: FormData
): Promise<AuthState> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as { sub?: string } | undefined

  if (!claims?.sub) {
    return formError(undefined, {}, 'You must be signed in to delete a note.')
  }

  const { data, error } = await supabase
    .from('work_order_notes')
    .delete()
    .eq('id', noteId)
    .select('work_order_id')
    .single()

  if (error) {
    return formError(undefined, {}, error.message)
  }

  revalidatePath(`/work-orders/${data.work_order_id}`)
  return { status: 'success', message: 'Note deleted.' }
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
