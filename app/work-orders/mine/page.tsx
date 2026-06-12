import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getTimeZone } from '@/lib/datetime/timezone'
import { createClient } from '@/lib/supabase/server'
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

export const metadata: Metadata = { title: 'My Work Orders' }

export default async function MyWorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  // Every row here is already assigned to the current user, so the assignee
  // filter is dropped.
  const filters = { ...parseWorkOrderFilters(params), assignees: [] }
  const sort = parseSort(params)
  const page = parsePage(params)

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as { sub?: string } | undefined

  if (!claims?.sub) redirect('/login')

  const order = sort ?? DEFAULT_SORT
  const from = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('work_orders')
    .select(
      'id, work_order_code, title, category, status, property, assigned_to, priority, due_at, reported_by_name, created_at',
      { count: 'exact' }
    )
    .eq('assigned_to', claims.sub)
    .not('status', 'in', '(pending,rejected)')

  query = applyWorkOrderFilters(query, filters)

  const { data, error, count } = await query
    .order(SORT_COLUMNS[order.key].column, {
      ascending: order.dir === 'asc',
      nullsFirst: false,
    })
    .order('work_order_number', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  const workOrders = (data ?? []) as WorkOrderListItem[]
  const timeZone = await getTimeZone()
  const filtersActive = hasActiveFilters(filters)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">My Work Orders</h1>
        <p className="text-sm text-muted-foreground">
          Work orders assigned to you, active work first.
        </p>
      </div>

      <FilterBar showAssignee={false} />

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}

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

      <TablePagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </div>
  )
}
