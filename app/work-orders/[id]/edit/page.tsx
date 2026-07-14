import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { buttonVariants } from '@/components/ui/button'
import {
  MAIN_TABLE_STATUSES,
  STATUS_LABELS,
  WORK_ORDER_STATUSES,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'
import { fetchWorkOrderAttachments } from '@/lib/work-orders/attachments'
import { fetchAssignableUsers } from '@/lib/work-orders/assignable-users'

import { EditWorkOrderForm } from './edit-work-order-form'
import { TransitionStatusForm } from './transition-status-form'

export const metadata: Metadata = { title: 'Edit Work Order' }

type WorkOrderRow = {
  id: string
  work_order_code: string
  title: string
  category: WorkOrderCategory
  status: WorkOrderStatus
  property: Property | null
  unit_number: string | null
  priority: WorkOrderPriority
  due_at: string | null
  description: string
  resolution: string | null
  assigned_to: string | null
  notify_recipients: string[] | null
  validated_by: string | null
  created_by: string
  reported_by_name: string | null
  reported_by_email: string | null
  reported_by_phone: string | null
  provider: string | null
  it_request_type: string | null
  marketing_request_type: string | null
  marketing_request_type_other: string | null
  marketing_event_name: string | null
  marketing_target_audience: string[] | null
  marketing_target_audience_other: string | null
  marketing_key_message: string | null
  marketing_size_format: string[] | null
  marketing_size_format_other: string | null
}

export default async function EditWorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as
    | { sub?: string; user_role?: string }
    | undefined

  if (!claims) redirect('/login')

  const [{ data, error }, assignableUsers] = await Promise.all([
    supabase
      .from('work_orders')
      .select(
        'id, work_order_code, title, category, status, property, unit_number, priority, due_at, description, resolution, assigned_to, notify_recipients, validated_by, created_by, reported_by_name, reported_by_email, reported_by_phone, provider, it_request_type, marketing_request_type, marketing_request_type_other, marketing_event_name, marketing_target_audience, marketing_target_audience_other, marketing_key_message, marketing_size_format, marketing_size_format_other'
      )
      .eq('id', id)
      .maybeSingle<WorkOrderRow>(),
    fetchAssignableUsers(supabase),
  ])

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="font-heading text-2xl font-semibold">Edit Work Order</h1>
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!data) notFound()

  const attachments = await fetchWorkOrderAttachments(supabase, data.id)

  const role = claims.user_role
  const isAdmin = role === 'administrator'
  const isTechnician = role === 'technician'
  const isInspector = role === 'inspector'
  // Requesters may only edit work orders they created or are assigned to;
  // administrators may edit any. Mirrors the RLS update policy.
  const isEditor =
    isAdmin ||
    (role === 'requester' &&
      (data.created_by === claims.sub || data.assigned_to === claims.sub))

  // Once a work order is approved and in the main table, every editor may only
  // move it between the main workflow statuses: Open, In Progress, Done, and
  // Closed. Pending and rejected belong to the submission/approval flow, which
  // is out of the main table: admins keep the full set there to manage
  // approvals, and non-admin editors are locked to the current state.
  const isApproved = data.status !== 'pending' && data.status !== 'rejected'
  const allowedStatuses: WorkOrderStatus[] = isApproved
    ? [...MAIN_TABLE_STATUSES]
    : isAdmin
      ? [...WORK_ORDER_STATUSES]
      : data.status === 'pending'
        ? ['pending']
        : ['rejected']

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            Edit Work Order
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium tabular-nums text-foreground">
              {data.work_order_code}
            </span>{' '}
            · Currently <strong>{STATUS_LABELS[data.status]}</strong>.
          </p>
        </div>
        <Link
          href="/work-orders"
          className={buttonVariants({ variant: 'outline', size: 'lg' })}
        >
          Back to list
        </Link>
      </div>

      {isEditor ? (
        <EditWorkOrderForm
          workOrder={data}
          allowedStatuses={allowedStatuses}
          assignableUsers={assignableUsers}
          attachments={attachments}
        />
      ) : isTechnician || isInspector ? (
        <TransitionStatusForm
          workOrderId={data.id}
          currentStatus={data.status}
          role={role as 'technician' | 'inspector'}
          assignableUsers={assignableUsers}
        />
      ) : (
        <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10 shadow-md dark:shadow-none">
          <p className="text-sm text-muted-foreground">
            Your role does not have permission to edit work orders.
          </p>
        </div>
      )}
    </div>
  )
}
