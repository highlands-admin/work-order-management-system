import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { BackButton } from '@/app/work-orders/[id]/back-button'
import {
  type Property,
  type RecurrenceFrequency,
  type WorkOrderCategory,
  type WorkOrderPriority,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'
import { fetchAssignableUsers } from '@/lib/work-orders/assignable-users'

import { EditRecurringForm, type RecurringSchedule } from './edit-recurring-form'

export const metadata: Metadata = { title: 'Edit Recurring Schedule' }

type ScheduleRow = RecurringSchedule & {
  category: WorkOrderCategory
  priority: WorkOrderPriority
  property: Property | null
  frequency: RecurrenceFrequency
  created_by: string
}

export default async function EditRecurringSchedulePage({
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
  // Administrators may edit any schedule; requesters only ones they created.
  const role = claims.user_role
  if (role !== 'administrator' && role !== 'requester') {
    redirect('/work-orders/recurring')
  }

  const [{ data, error }, assignableUsers] = await Promise.all([
    supabase
      .from('recurring_work_orders')
      .select(
        'id, title, category, priority, property, unit_number, description, provider, assigned_to, frequency, next_due_at, reminder_lead_days, reminder_recipients, active, created_by'
      )
      .eq('id', id)
      .maybeSingle<ScheduleRow>(),
    fetchAssignableUsers(supabase),
  ])

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="font-heading text-2xl font-semibold">
          Edit Recurring Schedule
        </h1>
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!data) notFound()
  if (role === 'requester' && data.created_by !== claims.sub) {
    redirect('/work-orders/recurring')
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            Edit Recurring Schedule
          </h1>
          <p className="text-sm text-muted-foreground">
            Changes apply to occurrences generated from now on.
          </p>
        </div>
        <BackButton fallbackHref="/work-orders/recurring?view=table" />
      </div>

      <EditRecurringForm schedule={data} assignableUsers={assignableUsers} />
    </div>
  )
}
