import { RiAddLine } from '@remixicon/react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
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
} from '@/lib/work-orders/filters'
import {
  parseWidthsCookieValue,
  WORK_ORDERS_WIDTHS_COOKIE,
} from '@/lib/work-orders/list-column-widths-cookie'
import {
  FILTERS_COOKIE,
  normalizeFilterQuery,
} from '@/lib/work-orders/list-filters-cookie'
import {
  PAGE_SIZE_COOKIE,
  resolvePageSize,
} from '@/lib/work-orders/list-page-size'
import {
  DEFAULT_SORT,
  hasSortParams,
  isSortable,
  parsePage,
  parseSort,
  SORT_COLUMNS,
} from '@/lib/work-orders/list-sort'
import {
  parseSortCookieValue,
  SORT_COOKIE,
} from '@/lib/work-orders/list-sort-cookie'

import { FilterBar } from './filter-bar'
import { WorkOrdersTable, type WorkOrderListItem } from './work-orders-table'

export const metadata: Metadata = { title: 'Cadence' }

const FILER_ROLES = new Set(['administrator', 'requester'])

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Resolve the filters for this request without a redirect -- a redirect
  // would cost an extra round trip and flash the unfiltered view first.
  // Explicit URL params always win; otherwise, on a list that's never been
  // touched, fall back to whatever was last persisted (even an explicitly
  // cleared, empty state).
  const cookieStore = await cookies()

  let filters = parseWorkOrderFilters(params)
  if (!hasFilterParams(params)) {
    const persisted = cookieStore.get(FILTERS_COOKIE)
    if (persisted) {
      filters = parseWorkOrderFilters(
        new URLSearchParams(normalizeFilterQuery(persisted.value))
      )
    }
  }

  // Same no-redirect resolution as the filters: an explicit ?sort wins;
  // otherwise fall back to a persisted sort (including an explicit reset to
  // this list's default, which the cookie stores as an empty value).
  let sort = parseSort(params)
  if (!hasSortParams(params)) {
    const persisted = cookieStore.get(SORT_COOKIE)
    if (persisted) sort = parseSortCookieValue(persisted.value, isSortable)
  }

  const columnWidths = parseWidthsCookieValue(
    cookieStore.get(WORK_ORDERS_WIDTHS_COOKIE)?.value
  )

  const page = parsePage(params)
  const pageSize = resolvePageSize(
    params.size,
    cookieStore.get(PAGE_SIZE_COOKIE)?.value
  )

  // pending / rejected submissions live on /work-orders/submissions; this
  // page is the operational view of approved work.
  let query = supabase
    .from('work_orders')
    .select(
      'id, work_order_code, title, category, status, property, assigned_to, priority, due_at, reported_by_name, recurring_work_order_id, created_at',
      { count: 'exact' }
    )
    .not('status', 'in', '(pending,rejected)')

  query = applyWorkOrderFilters(query, filters)

  // Order by the requested column (default newest first), with work_order_number
  // as a stable tiebreaker so paging is deterministic, then slice to the page.
  const order = sort ?? DEFAULT_SORT
  const from = (page - 1) * pageSize
  query = query
    .order(SORT_COLUMNS[order.key].column, {
      ascending: order.dir === 'asc',
      nullsFirst: false,
    })
    .order('work_order_number', { ascending: false })
    .range(from, from + pageSize - 1)

  // Fan out the JWT claims read and the table query in parallel. Auth
  // succeeded earlier in the layout, so we don't need claims before issuing
  // the table query - RLS independently enforces who can see what.
  const [claimsResult, queryResult, assignableUsers] = await Promise.all([
    supabase.auth.getClaims(),
    query,
    fetchAssignableUsers(supabase),
  ])
  const userRole = (claimsResult.data?.claims as
    | { user_role?: string }
    | undefined)?.user_role
  const canFile = userRole ? FILER_ROLES.has(userRole) : false
  const { data, error, count } = queryResult
  const workOrders = (data ?? []) as WorkOrderListItem[]
  const userLabelById: Record<string, string> = Object.fromEntries(
    assignableUsers.map((u) => [u.user_id, formatAssigneeLabel(u)])
  )
  const assigneeOptions = assignableUsers.map((u) => ({
    value: u.user_id,
    label: formatAssigneeLabel(u),
  }))
  const filtersActive = hasActiveFilters(filters)
  const timeZone = await getTimeZone()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Work Orders</h1>
          <p className="text-sm text-muted-foreground">
            Every work order across all facilities, active work first.
          </p>
        </div>
        {canFile ? (
          <Link
            href="/work-orders/new"
            className={buttonVariants({ size: 'cta' })}
          >
            <RiAddLine className="size-5" />
            New work order
          </Link>
        ) : null}
      </div>

      <FilterBar
        assigneeOptions={assigneeOptions}
        exportPath="/work-orders/export"
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
        pagination={{ page, pageSize, total: count ?? 0 }}
        initialColumnWidths={columnWidths}
        assigneeOptions={assigneeOptions}
        initialFilters={filters}
        emptyMessage={
          filtersActive
            ? 'No work orders match these filters.'
            : 'No work orders yet.'
        }
      />
    </div>
  )
}
