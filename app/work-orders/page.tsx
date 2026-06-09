import { RiAddLine } from '@remixicon/react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import {
  fetchAssignableUsers,
  formatAssigneeLabel,
} from '@/lib/work-orders/assignable-users'
import {
  hasActiveFilters,
  parseWorkOrderFilters,
  UNASSIGNED,
} from '@/lib/work-orders/filters'

import { FilterBar } from './filter-bar'
import { WorkOrdersTable, type WorkOrderListItem } from './work-orders-table'

export const metadata: Metadata = { title: 'Work orders' }

const FILER_ROLES = new Set(['administrator', 'requester'])
const ROW_LIMIT = 100

// Strip characters that would either break PostgREST's .or() syntax or be
// interpreted as ilike wildcards. The remaining string is wrapped with `*`
// wildcards on the query side.
function sanitizeSearchTerm(q: string): string {
  return q.replace(/[,()*%_\\]/g, '').trim().slice(0, 100)
}

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filters = parseWorkOrderFilters(params)

  const supabase = await createClient()

  // pending / rejected submissions live on /work-orders/submissions; this
  // page is the operational view of approved work.
  let query = supabase
    .from('work_orders')
    .select(
      'id, work_order_code, title, category, status, property, assigned_to, priority, due_at, reported_by_name, created_at'
    )
    .not('status', 'in', '(pending,rejected)')
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT)

  if (filters.statuses.length) query = query.in('status', filters.statuses)
  if (filters.priorities.length)
    query = query.in('priority', filters.priorities)
  if (filters.categories.length)
    query = query.in('category', filters.categories)
  if (filters.properties.length)
    query = query.in('property', filters.properties)
  if (filters.assignees.length) {
    const includeUnassigned = filters.assignees.includes(UNASSIGNED)
    const ids = filters.assignees.filter((a) => a !== UNASSIGNED)
    if (includeUnassigned && ids.length) {
      query = query.or(`assigned_to.is.null,assigned_to.in.(${ids.join(',')})`)
    } else if (includeUnassigned) {
      query = query.is('assigned_to', null)
    } else {
      query = query.in('assigned_to', ids)
    }
  }

  if (filters.dueFrom) {
    query = query.gte('due_at', `${filters.dueFrom}T00:00:00.000Z`)
  }
  if (filters.dueTo) {
    query = query.lte('due_at', `${filters.dueTo}T23:59:59.999Z`)
  }
  if (filters.createdFrom) {
    query = query.gte('created_at', `${filters.createdFrom}T00:00:00.000Z`)
  }
  if (filters.createdTo) {
    query = query.lte('created_at', `${filters.createdTo}T23:59:59.999Z`)
  }

  const safeQ = sanitizeSearchTerm(filters.q)
  if (safeQ) {
    query = query.or(
      `work_order_code.ilike.*${safeQ}*,title.ilike.*${safeQ}*,description.ilike.*${safeQ}*,unit_number.ilike.*${safeQ}*,reported_by_name.ilike.*${safeQ}*`
    )
  }

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
  const { data, error } = queryResult
  const workOrders = (data ?? []) as WorkOrderListItem[]
  const userLabelById: Record<string, string> = Object.fromEntries(
    assignableUsers.map((u) => [u.user_id, formatAssigneeLabel(u)])
  )
  const assigneeOptions = assignableUsers.map((u) => ({
    value: u.user_id,
    label: formatAssigneeLabel(u),
  }))
  const filtersActive = hasActiveFilters(filters)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Work Orders</h1>
          <p className="text-sm text-muted-foreground">
            Every work order across all properties, newest first.
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

      <FilterBar assigneeOptions={assigneeOptions} />

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}

      <WorkOrdersTable
        workOrders={workOrders}
        userLabelById={userLabelById}
        emptyMessage={
          filtersActive
            ? 'No work orders match these filters.'
            : 'No work orders yet.'
        }
      />

      {workOrders.length === ROW_LIMIT ? (
        <p className="text-xs text-muted-foreground">
          Showing the first {ROW_LIMIT} matching work orders. Narrow the filters to
          see more.
        </p>
      ) : null}
    </div>
  )
}
