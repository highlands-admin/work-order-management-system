import { RiRepeatLine } from '@remixicon/react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getTimeZone } from '@/lib/datetime/timezone'
import {
  type Property,
  type RecurrenceFrequency,
  type WorkOrderCategory,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'
import {
  fetchAssignableUsers,
  formatAssigneeLabel,
} from '@/lib/work-orders/assignable-users'

import { RecurringCalendar, type CalendarSchedule } from './recurring-calendar'
import { RecurringTable } from './recurring-table'
import { RecurringViewToggle } from './view-toggle'

export const metadata: Metadata = { title: 'Recurring Schedules' }

const EDITOR_ROLES = new Set(['administrator', 'requester'])

type RecurringRow = {
  id: string
  title: string
  category: WorkOrderCategory
  property: Property | null
  unit_number: string | null
  provider: string | null
  frequency: RecurrenceFrequency
  recurrence_interval: number
  anchor_date: string
  next_due_at: string | null
  reminder_lead_days: number[]
  reminder_recipients: string[]
  assigned_to: string | null
  active: boolean
}

export default async function RecurringWorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const view = params.view === 'table' ? 'table' : 'calendar'

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as { user_role?: string } | undefined

  if (!claims) redirect('/login')

  const [{ data, error }, assignableUsers, timeZone] = await Promise.all([
    supabase
      .from('recurring_work_orders')
      .select(
        'id, title, category, property, unit_number, provider, frequency, recurrence_interval, anchor_date, next_due_at, reminder_lead_days, reminder_recipients, assigned_to, active'
      )
      .order('active', { ascending: false })
      .order('next_due_at', { ascending: true, nullsFirst: false })
      .returns<RecurringRow[]>(),
    fetchAssignableUsers(supabase),
    getTimeZone(),
  ])

  const userLabelById = new Map(
    assignableUsers.map((u) => [u.user_id, formatAssigneeLabel(u)])
  )
  const rows = data ?? []
  const canEdit = claims.user_role
    ? EDITOR_ROLES.has(claims.user_role)
    : false

  const calendarSchedules: CalendarSchedule[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    property: row.property,
    unit_number: row.unit_number,
    frequency: row.frequency,
    recurrence_interval: row.recurrence_interval,
    anchor_date: row.anchor_date,
    provider: row.provider,
    active: row.active,
  }))

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            Recurring Schedules
          </h1>
          <p className="text-sm text-muted-foreground">
            Each schedule files a work order and emails a reminder before every
            due date.
          </p>
        </div>
        <RecurringViewToggle view={view} />
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : view === 'calendar' ? (
        <RecurringCalendar schedules={calendarSchedules} canEdit={canEdit} />
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <RecurringTable
          schedules={rows}
          userLabelById={Object.fromEntries(userLabelById)}
          timeZone={timeZone}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <RiRepeatLine className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">No recurring work orders yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Create a work order in the License/Permit or Compliance/Inspection category and
        choose a frequency to make it recurring.
      </p>
    </div>
  )
}
