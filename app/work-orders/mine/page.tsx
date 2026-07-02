import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { getTimeZone } from '@/lib/datetime/timezone'
import { createClient } from '@/lib/supabase/server'
import { fetchAssignableUsers } from '@/lib/work-orders/assignable-users'
import { MINE_VIEW_COOKIE, resolveView } from '@/lib/work-orders/list-view'
import { applyWorkOrderFilters } from '@/lib/work-orders/apply-filters'
import {
  hasActiveFilters,
  parseWorkOrderFilters,
} from '@/lib/work-orders/filters'
import {
  DEFAULT_SORT,
  PAGE_SIZE,
  parsePage,
  parseSort,
  SORT_COLUMNS,
} from '@/lib/work-orders/list-sort'

import { FilterBar } from '../filter-bar'
import { TablePagination } from '../table-pagination'
import { WorkOrdersTable, type WorkOrderListItem } from '../work-orders-table'
import { KanbanBoard } from './kanban-board'
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
  // Every row here is already assigned to the current user, so the assignee
  // filter is dropped.
  const filters = { ...parseWorkOrderFilters(params), assignees: [] }
  const sort = parseSort(params)
  const page = parsePage(params)

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as { sub?: string } | undefined

  if (!claims?.sub) redirect('/login')

  const base = applyWorkOrderFilters(
    supabase
      .from('work_orders')
      .select(
        'id, work_order_code, title, category, status, property, assigned_to, priority, due_at, reported_by_name, recurring_work_order_id, created_at',
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
    workOrders = (result.data ?? []) as WorkOrderListItem[]
    error = result.error
  } else {
    const order = sort ?? DEFAULT_SORT
    const from = (page - 1) * PAGE_SIZE
    const result = await base
      .order(SORT_COLUMNS[order.key].column, {
        ascending: order.dir === 'asc',
        nullsFirst: false,
      })
      .order('work_order_number', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    workOrders = (result.data ?? []) as WorkOrderListItem[]
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

      <FilterBar showAssignee={false} />

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}

      {view === 'board' ? (
        workOrders.length === 0 ? (
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
            <p className="p-6 text-sm text-muted-foreground">
              {filtersActive
                ? 'No work orders match these filters.'
                : "You don't have any work orders assigned yet."}
            </p>
          </div>
        ) : (
          <KanbanBoard
            workOrders={workOrders}
            timeZone={timeZone}
            users={assignableUsers}
          />
        )
      ) : (
        <>
          <WorkOrdersTable
            workOrders={workOrders}
            userLabelById={{}}
            timeZone={timeZone}
            sort={sort}
            showAssignee={false}
            emptyMessage={
              filtersActive
                ? 'No work orders match these filters.'
                : "You don't have any work orders assigned yet."
            }
          />

          <TablePagination page={page} pageSize={PAGE_SIZE} total={count} />
        </>
      )}
    </div>
  )
}
