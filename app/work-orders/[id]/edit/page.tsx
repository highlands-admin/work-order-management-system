import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { buttonVariants } from '@/components/ui/button'
import {
  STATUS_LABELS,
  WORK_ORDER_STATUSES,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'
import { fetchAssignableUsers } from '@/lib/work-orders/assignable-users'

import { EditWorkOrderForm } from './edit-work-order-form'
import { TransitionStatusForm } from './transition-status-form'

export const metadata: Metadata = { title: 'Edit Work Order' }

const EDITOR_ROLES = new Set(['administrator', 'requester'])

type WorkOrderRow = {
  id: string
  category: WorkOrderCategory
  status: WorkOrderStatus
  property: Property | null
  unit_number: string | null
  priority: WorkOrderPriority
  due_at: string | null
  description: string
  resolution: string | null
  assigned_to: string
  reported_by_name: string | null
  reported_by_email: string | null
  reported_by_phone: string | null
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
        'id, category, status, property, unit_number, priority, due_at, description, resolution, assigned_to, reported_by_name, reported_by_email, reported_by_phone'
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

  const role = claims.user_role
  const isEditor = role ? EDITOR_ROLES.has(role) : false
  const isAdmin = role === 'administrator'
  const isTechnician = role === 'technician'
  const isInspector = role === 'inspector'

  // Approval transitions are admin-only. Non-admin editors get a filtered
  // status list so the UI matches what the database trigger enforces.
  const allowedStatuses: WorkOrderStatus[] = isAdmin
    ? [...WORK_ORDER_STATUSES]
    : data.status === 'pending'
      ? ['pending']
      : data.status === 'rejected'
        ? ['rejected']
        : WORK_ORDER_STATUSES.filter(
            (s) => s !== 'pending' && s !== 'rejected'
          )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            Edit Work Order
          </h1>
          <p className="text-sm text-muted-foreground">
            Currently <strong>{STATUS_LABELS[data.status]}</strong>.
          </p>
        </div>
        <Link
          href="/work-orders"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Back to list
        </Link>
      </div>

      {isEditor ? (
        <EditWorkOrderForm
          workOrder={data}
          allowedStatuses={allowedStatuses}
          assignableUsers={assignableUsers}
        />
      ) : isTechnician || isInspector ? (
        <TransitionStatusForm
          workOrderId={data.id}
          currentStatus={data.status}
          role={role as 'technician' | 'inspector'}
        />
      ) : (
        <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">
            Your role does not have permission to edit work orders.
          </p>
        </div>
      )}
    </div>
  )
}
