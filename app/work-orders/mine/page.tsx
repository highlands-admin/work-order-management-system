import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { getTimeZone } from '@/lib/datetime/timezone'
import { createClient } from '@/lib/supabase/server'
import { fetchAssignableUsers } from '@/lib/work-orders/assignable-users'
import {
  DEFAULT_BOARD_COLUMNS,
  MINE_BOARD_COLUMNS_COOKIE,
  parseBoardColumnsCookieValue,
} from '@/lib/work-orders/board-columns-cookie'
import { MINE_VIEW_COOKIE, resolveView } from '@/lib/work-orders/list-view'
import {
  applyWorkOrderFilters,
  sanitizeSearchTerm,
} from '@/lib/work-orders/apply-filters'
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
  MINE_FILTERS_COOKIE,
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
  MINE_SORT_COOKIE,
  parseSortCookieValue,
} from '@/lib/work-orders/list-sort-cookie'

import { FilterBar } from '../filter-bar'
import { WorkOrdersTable, type WorkOrderListItem } from '../work-orders-table'
import { BoardWorkspace } from './board-workspace'
import { ViewToggle } from './view-toggle'

export const metadata: Metadata = { title: 'My Work Orders' }

// Cap for the board, which is not paginated. A single assignee is very unlikely
// to exceed this many active work orders.
const BOARD_CAP = 200

export default async function MyWorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const cookieStore = await cookies()

  const view = resolveView(
    ['table', 'board'] as const,
    params.view,
    cookieStore.get(MINE_VIEW_COOKIE)?.value,
    'table'
  )

  // Resolve the filters for this request without a redirect -- a redirect
  // would cost an extra round trip and flash the unfiltered view first.
  // Explicit URL params always win; otherwise, on a list that's never been
  // touched, fall back to whatever was last persisted (even an explicitly
  // cleared, empty state). Every row here is already assigned to the current
  // user, so the assignee filter is always dropped.
  let filters = { ...parseWorkOrderFilters(params), assignees: [] as string[] }
  if (!hasFilterParams(params)) {
    const persisted = cookieStore.get(MINE_FILTERS_COOKIE)
    if (persisted) {
      filters = {
        ...parseWorkOrderFilters(
          new URLSearchParams(normalizeFilterQuery(persisted.value))
        ),
        assignees: [],
      }
    }
  }
  // Same no-redirect resolution as the filters: an explicit ?sort wins;
  // otherwise fall back to a persisted sort (including an explicit reset to
  // this list's default, which the cookie stores as an empty value).
  let sort = parseSort(params)
  if (!hasSortParams(params)) {
    const persisted = cookieStore.get(MINE_SORT_COOKIE)
    if (persisted) sort = parseSortCookieValue(persisted.value, isSortable)
  }

  const columnWidths = parseWidthsCookieValue(
    cookieStore.get(WORK_ORDERS_WIDTHS_COOKIE)?.value
  )

  // Which board columns to show. No saved selection falls back to the default.
  const boardColumns =
    parseBoardColumnsCookieValue(
      cookieStore.get(MINE_BOARD_COLUMNS_COOKIE)?.value
    ) ?? [...DEFAULT_BOARD_COLUMNS]

  const page = parsePage(params)
  const pageSize = resolvePageSize(
    params.size,
    cookieStore.get(PAGE_SIZE_COOKIE)?.value
  )

  // The matched-text snippet is a table-view feature, so fetch the search blob
  // only when the table is showing and a search is active.
  const highlight = view === 'table' ? sanitizeSearchTerm(filters.q) : ''

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as { sub?: string } | undefined

  if (!claims?.sub) redirect('/login')

  const base = applyWorkOrderFilters(
    supabase
      .from('work_orders')
      .select(
        `id, work_order_code, title, category, status, property, assigned_to, priority, due_at, reported_by_name, recurring_work_order_id, created_at, updated_at${
          highlight ? ', description, unit_number, search_text' : ''
        }`,
        { count: 'exact' }
      )
      .eq('assigned_to', claims.sub)
      .not('status', 'in', '(pending,rejected)'),
    filters
  )

  let workOrders: WorkOrderListItem[] = []
  let count = 0
  let error: { message: string } | null = null

  if (view === 'board') {
    // The board groups by status, so order by priority (urgent first) within
    // each column, newest as the tiebreaker. No pagination.
    const result = await base
      .order('priority', { ascending: true })
      .order('work_order_number', { ascending: false })
      .range(0, BOARD_CAP - 1)
    workOrders = (result.data ?? []) as unknown as WorkOrderListItem[]
    error = result.error
  } else {
    const order = sort ?? DEFAULT_SORT
    const from = (page - 1) * pageSize
    const result = await base
      .order(SORT_COLUMNS[order.key].column, {
        ascending: order.dir === 'asc',
        nullsFirst: false,
      })
      .order('work_order_number', { ascending: false })
      .range(from, from + pageSize - 1)
    workOrders = (result.data ?? []) as unknown as WorkOrderListItem[]
    count = result.count ?? 0
    error = result.error
  }

  const timeZone = await getTimeZone()
  const filtersActive = hasActiveFilters(filters)
  // The board's close flow needs the user directory for the Validated By field.
  const assignableUsers = await fetchAssignableUsers(supabase)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">My Work Orders</h1>
          <p className="text-sm text-muted-foreground">
            {view === 'board'
              ? 'Drag a work order between columns to change its status.'
              : 'Work orders assigned to you, active work first.'}
          </p>
        </div>
        <ViewToggle view={view} />
      </div>

      {view === 'board' ? (
        <BoardWorkspace
          workOrders={workOrders}
          timeZone={timeZone}
          users={assignableUsers}
          initialColumns={boardColumns}
          initialFilters={filters}
          error={error?.message ?? null}
          emptyMessage={
            filtersActive
              ? 'No work orders match these filters.'
              : "You don't have any work orders assigned yet."
          }
        />
      ) : (
        <>
          <FilterBar showAssignee={false} initialFilters={filters} />

          {error ? (
            <p className="text-sm text-destructive">{error.message}</p>
          ) : null}

          <WorkOrdersTable
            workOrders={workOrders}
            userLabelById={{}}
            timeZone={timeZone}
            sort={sort}
            showAssignee={false}
            pagination={{ page, pageSize, total: count }}
            highlight={highlight || undefined}
            initialColumnWidths={columnWidths}
            initialFilters={filters}
            emptyMessage={
              filtersActive
                ? 'No work orders match these filters.'
                : "You don't have any work orders assigned yet."
            }
          />
        </>
      )}
    </div>
  )
}
