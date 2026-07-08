import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { getTimeZone } from '@/lib/datetime/timezone'
import { createClient } from '@/lib/supabase/server'
import {
  fetchAssignableUsers,
  formatAssigneeLabel,
} from '@/lib/work-orders/assignable-users'
import { applyWorkOrderFilters } from '@/lib/work-orders/apply-filters'
import {
  hasActiveFilters,
  hasFilterParams,
  parseWorkOrderFilters,
  type WorkOrderFilters,
} from '@/lib/work-orders/filters'
import {
  parseWidthsCookieValue,
  WORK_ORDERS_WIDTHS_COOKIE,
} from '@/lib/work-orders/list-column-widths-cookie'
import {
  ARCHIVE_FILTERS_COOKIE,
  normalizeFilterQuery,
} from '@/lib/work-orders/list-filters-cookie'
import {
  hasSortParams,
  isSortable,
  PAGE_SIZE,
  parsePage,
  parseSort,
  SORT_COLUMNS,
  type ListSort,
} from '@/lib/work-orders/list-sort'
import {
  ARCHIVE_SORT_COOKIE,
  parseSortCookieValue,
} from '@/lib/work-orders/list-sort-cookie'

import { FilterBar } from '../filter-bar'
import {
  WorkOrdersTable,
  type WorkOrderListItem,
} from '../work-orders-table'

export const metadata: Metadata = { title: 'Archive' }

// Newest rejection first when the user has not chosen a sort. Status is the
// list default elsewhere, but every row here is rejected, so that would be
// meaningless.
const DEFAULT_ARCHIVE_SORT: ListSort = { key: 'created', dir: 'desc' }

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const cookieStore = await cookies()

  // Resolve the filters for this request without a redirect -- a redirect
  // would cost an extra round trip and flash the unfiltered view first.
  // Explicit URL params always win; otherwise, on a list that's never been
  // touched, fall back to whatever was last persisted (even an explicitly
  // cleared, empty state). Every row here is already rejected, so the status
  // facet is always dropped.
  let filters: WorkOrderFilters = {
    ...parseWorkOrderFilters(params),
    statuses: [],
  }
  if (!hasFilterParams(params)) {
    const persisted = cookieStore.get(ARCHIVE_FILTERS_COOKIE)
    if (persisted) {
      filters = {
        ...parseWorkOrderFilters(
          new URLSearchParams(normalizeFilterQuery(persisted.value))
        ),
        statuses: [],
      }
    }
  }
  const filtersActive = hasActiveFilters(filters)

  // Same no-redirect resolution as the filters: an explicit ?sort wins;
  // otherwise fall back to a persisted sort (including an explicit reset to
  // this list's default, which the cookie stores as an empty value).
  let sort = parseSort(params)
  if (!hasSortParams(params)) {
    const persisted = cookieStore.get(ARCHIVE_SORT_COOKIE)
    if (persisted) sort = parseSortCookieValue(persisted.value, isSortable)
  }

  const columnWidths = parseWidthsCookieValue(
    cookieStore.get(WORK_ORDERS_WIDTHS_COOKIE)?.value
  )

  const page = parsePage(params)

  const supabase = await createClient()

  // RLS scopes this: administrators see every rejected work order, requesters
  // see only the ones they created (policy in
  // 20260513120011_work_order_approval.sql), so no created_by filter is needed.
  let query = supabase
    .from('work_orders')
    .select(
      'id, work_order_code, title, category, status, property, assigned_to, priority, due_at, reported_by_name, recurring_work_order_id, created_at',
      { count: 'exact' }
    )
    .eq('status', 'rejected')

  query = applyWorkOrderFilters(query, filters)

  const order = sort ?? DEFAULT_ARCHIVE_SORT
  const from = (page - 1) * PAGE_SIZE
  query = query
    .order(SORT_COLUMNS[order.key].column, {
      ascending: order.dir === 'asc',
      nullsFirst: false,
    })
    .order('work_order_number', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  const [claimsResult, queryResult, assignableUsers] = await Promise.all([
    supabase.auth.getClaims(),
    query,
    fetchAssignableUsers(supabase),
  ])

  const userRole = (
    claimsResult.data?.claims as { user_role?: string } | undefined
  )?.user_role
  const canModerate = userRole === 'administrator'

  const { data, error, count } = queryResult
  const workOrders = (data ?? []) as WorkOrderListItem[]
  const userLabelById: Record<string, string> = Object.fromEntries(
    assignableUsers.map((u) => [u.user_id, formatAssigneeLabel(u)])
  )
  const assigneeOptions = assignableUsers.map((u) => ({
    value: u.user_id,
    label: formatAssigneeLabel(u),
  }))
  const timeZone = await getTimeZone()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Archive</h1>
        <p className="text-sm text-muted-foreground">
          {canModerate
            ? 'Work orders that were rejected during review.'
            : 'Your submissions that were rejected during review.'}
        </p>
      </div>

      <FilterBar
        assigneeOptions={assigneeOptions}
        showStatus={false}
        initialFilters={filters}
      />

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}

      <WorkOrdersTable
        workOrders={workOrders}
        userLabelById={userLabelById}
        timeZone={timeZone}
        sort={sort}
        showStatus={false}
        pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
        initialColumnWidths={columnWidths}
        assigneeOptions={assigneeOptions}
        emptyMessage={
          filtersActive
            ? 'No archived work orders match these filters.'
            : canModerate
              ? 'No rejected work orders.'
              : 'None of your submissions have been rejected.'
        }
      />
    </div>
  )
}
