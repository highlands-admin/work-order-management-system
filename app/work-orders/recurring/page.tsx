import { RiRepeatLine } from '@remixicon/react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { getTimeZone } from '@/lib/datetime/timezone'
import {
  RECURRING_VIEW_COOKIE,
  resolveView,
} from '@/lib/work-orders/list-view'
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
import {
  applyRecurringFilters,
  hasActiveRecurringFilters,
  parseRecurringFilters,
} from '@/lib/work-orders/recurring-filters'
import {
  parseRecurringSort,
  RECURRING_SORT_COLUMNS,
} from '@/lib/work-orders/recurring-sort'
import { fetchFacilityPreferences } from '@/lib/work-orders/user-preferences'

import { RecurringCalendar, type CalendarSchedule } from './recurring-calendar'
import { RecurringFilterBar } from './recurring-filter-bar'
import { RecurringTable } from './recurring-table'
import { RecurringViewToggle } from './view-toggle'

export const metadata: Metadata = { title: 'Recurring Schedules' }

const RECURRING_COLUMNS =
  'id, title, category, property, unit_number, provider, frequency, recurrence_interval, anchor_date, next_due_at, reminder_lead_days, reminder_recipients, assigned_to, active, created_by'

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
  created_by: string
}

export default async function RecurringWorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const view = resolveView(
    ['calendar', 'table'] as const,
    params.view,
    cookieStore.get(RECURRING_VIEW_COOKIE)?.value,
    'calendar'
  )
  const isTable = view === 'table'
  const filters = parseRecurringFilters(params)
  const sort = parseRecurringSort(params)
  const filtersActive = hasActiveRecurringFilters(filters)

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as
    | { sub?: string; user_role?: string }
    | undefined

  if (!claims) redirect('/login')

  // Fresh visit: default to the user's preferred facilities. The redirect adds a
  // ?property filter that both views below honor; the calendar/table choice is
  // cookie-driven, so it survives.
  if (Object.keys(params).length === 0) {
    const preferred = await fetchFacilityPreferences(supabase)
    if (preferred.length > 0) {
      redirect(`/work-orders/recurring?property=${preferred.join(',')}`)
    }
  }

  // Search, sort, and the in-page filters apply to the table view only. The
  // facility filter also constrains the calendar, so both views match the user's
  // preferred facilities.
  let query = supabase.from('recurring_work_orders').select(RECURRING_COLUMNS)

  if (isTable) {
    query = applyRecurringFilters(query, filters)
    if (sort) {
      const column = RECURRING_SORT_COLUMNS[sort.key]
      query = query
        .order(column.column, {
          ascending: sort.dir === 'asc',
          nullsFirst: false,
        })
        .order('id', { ascending: true })
    } else {
      query = query
        .order('active', { ascending: false })
        .order('next_due_at', { ascending: true, nullsFirst: false })
    }
  } else {
    // The calendar has no filter bar, but it still honors the facility filter so
    // it reflects the user's preferred facilities (or an explicit ?property).
    if (filters.properties.length) {
      query = query.in('property', filters.properties)
    }
    query = query
      .order('active', { ascending: false })
      .order('next_due_at', { ascending: true, nullsFirst: false })
  }

  const [{ data, error }, assignableUsers, timeZone] = await Promise.all([
    query,
    fetchAssignableUsers(supabase),
    getTimeZone(),
  ])

  const userLabelById = new Map(
    assignableUsers.map((u) => [u.user_id, formatAssigneeLabel(u)])
  )
  const assigneeOptions = assignableUsers.map((u) => ({
    value: u.user_id,
    label: formatAssigneeLabel(u),
  }))
  const rows = (data ?? []) as RecurringRow[]

  // Administrators may edit any schedule; requesters only ones they created.
  // Schedules are only ever created by filers, so a created_by match is enough
  // to scope a requester to their own without re-checking the role.
  const isAdmin = claims.user_role === 'administrator'
  const canEditSchedule = (createdBy: string) =>
    isAdmin || createdBy === claims.sub

  const tableRows = rows.map((row) => ({
    ...row,
    editable: canEditSchedule(row.created_by),
  }))

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
    editable: canEditSchedule(row.created_by),
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

      {isTable ? <RecurringFilterBar assigneeOptions={assigneeOptions} /> : null}

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : view === 'calendar' ? (
        <RecurringCalendar schedules={calendarSchedules} />
      ) : rows.length === 0 ? (
        filtersActive ? (
          <NoMatches />
        ) : (
          <EmptyState />
        )
      ) : (
        <RecurringTable
          schedules={tableRows}
          userLabelById={Object.fromEntries(userLabelById)}
          timeZone={timeZone}
          sort={sort}
        />
      )}
    </div>
  )
}

function NoMatches() {
  return (
    <div className="rounded-xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">
        No recurring schedules match these filters.
      </p>
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
