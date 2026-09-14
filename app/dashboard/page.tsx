import {
  RiAlarmWarningLine,
  RiPulseLine,
  RiTimeLine,
  RiUserSearchLine,
} from '@remixicon/react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import type { ComponentType } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { applyWorkOrderFilters } from '@/lib/work-orders/apply-filters'
import {
  fetchAssignableUsers,
  formatAssigneeLabel,
} from '@/lib/work-orders/assignable-users'
import {
  computeDashboardStats,
  parseRange,
  RANGE_LABELS,
  type DashboardRange,
  type DashboardRow,
} from '@/lib/work-orders/dashboard-stats'
import {
  hasActiveFilters,
  hasFilterParams,
  parseWorkOrderFilters,
  toSearchParams,
} from '@/lib/work-orders/filters'
import {
  DASHBOARD_FILTERS_COOKIE,
  normalizeFilterQuery,
} from '@/lib/work-orders/list-filters-cookie'

import { DashboardCharts } from './dashboard-charts'
import { DashboardFilters } from './dashboard-filters'

export const metadata: Metadata = { title: { absolute: 'Dashboard · Workflow360' } }

const RANGE_ORDER: DashboardRange[] = ['30d', '90d', '365d', 'all']
const RANGE_SHORT: Record<DashboardRange, string> = {
  '30d': '30d',
  '90d': '90d',
  '365d': '12m',
  all: 'All',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const rangeParam = typeof params.range === 'string' ? params.range : undefined
  const range = parseRange(rangeParam)

  // An explicit filter in the URL always wins (even an empty one, meaning
  // "explicitly cleared"); otherwise, on a visit that carries none, fall back to
  // the persisted cookie -- same no-redirect resolution as the work-order list
  // filters, so there's no extra round trip or flash of the unfiltered view.
  let filters = parseWorkOrderFilters(params)
  if (!hasFilterParams(params)) {
    const cookieStore = await cookies()
    const persisted = cookieStore.get(DASHBOARD_FILTERS_COOKIE)
    if (persisted) {
      filters = parseWorkOrderFilters(
        new URLSearchParams(normalizeFilterQuery(persisted.value))
      )
    }
  }

  const supabase = await createClient()
  let query = supabase
    .from('work_orders')
    .select('status, category, priority, property, due_at, assigned_to, created_at')

  // The same filter application the list and the CSV export use, so a facet
  // means the same thing wherever it is set.
  query = applyWorkOrderFilters(query, filters)

  const [{ data, error }, assignableUsers] = await Promise.all([
    query,
    fetchAssignableUsers(supabase),
  ])

  if (error) {
    throw new Error(`Failed to load dashboard data: ${error.message}`)
  }

  const rows = (data ?? []) as DashboardRow[]
  const stats = computeDashboardStats(rows, range, filters.categories)
  const assigneeOptions = assignableUsers.map((u) => ({
    value: u.user_id,
    label: formatAssigneeLabel(u),
  }))
  // Every filter, as a query string, for the links that leave this page.
  const filterQuery = toSearchParams(filters).toString()

  // Links from the stat cards to the All Work Orders list, pre-filtered to match
  // each stat, carrying the dashboard's filters along. Statuses are comma-joined
  // like the filter bar writes them. Each card's own facets overwrite the
  // dashboard's, since the card is a narrower question than the page. Overdue is
  // approximated as active work due on or before today (the list filters by
  // date, not the exact timestamp the dashboard uses).
  const today = new Date().toISOString().slice(0, 10)
  function listHref(query: Record<string, string>): string {
    const sp = new URLSearchParams(filterQuery)
    for (const [key, value] of Object.entries(query)) sp.set(key, value)
    return `/work-orders?${sp.toString()}`
  }
  const activeHref = listHref({ status: 'open,in_progress' })
  const overdueHref = listHref({ status: 'open,in_progress', dueTo: today })
  const unassignedHref = listHref({
    status: 'open,in_progress',
    assignee: 'unassigned',
  })
  // Pending submissions are not on the All Work Orders list (it excludes
  // pending/rejected); they live in the approval queue.
  const pendingHref = '/work-orders/submissions'

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-base text-muted-foreground">
            {/* The default line claims a scope the filters can take away, so it
                steps aside once one is set. */}
            {hasActiveFilters(filters)
              ? 'Operations overview, scoped to the active filters.'
              : 'Operations overview across all facilities.'}
          </p>
        </div>
        <DashboardFilters
          selected={filters}
          assigneeOptions={assigneeOptions}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active"
          value={stats.active}
          hint="Open and in progress"
          icon={RiPulseLine}
          iconClassName="text-sky-500"
          href={activeHref}
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          hint="Past due, not closed"
          icon={RiAlarmWarningLine}
          iconClassName="text-rose-500"
          href={overdueHref}
        />
        <StatCard
          label="Unassigned"
          value={stats.unassigned}
          hint="Active without an assignee"
          icon={RiUserSearchLine}
          iconClassName="text-amber-500"
          href={unassignedHref}
        />
        <StatCard
          label="Pending Approval"
          value={stats.pending}
          hint="Awaiting review"
          icon={RiTimeLine}
          iconClassName="text-violet-500"
          href={pendingHref}
        />
      </div>

      <DashboardCharts
        byStatus={stats.byStatus}
        byCategory={stats.byCategory}
        byPriority={stats.byPriority}
        trend={stats.trend}
        rangeLabel={RANGE_LABELS[range]}
        rangeSelector={
          <RangeSelector current={range} filterQuery={filterQuery} />
        }
      />
    </div>
  )
}

function RangeSelector({
  current,
  filterQuery,
}: {
  current: DashboardRange
  // Carried along so switching ranges doesn't drop the filters -- this is a
  // plain server-rendered Link, not a client component that could read the
  // current URL itself.
  filterQuery: string
}) {
  return (
    <div className="flex items-center rounded-md border p-0.5">
      {RANGE_ORDER.map((range) => {
        const active = range === current
        const params = new URLSearchParams(filterQuery)
        params.set('range', range)
        return (
          <Link
            key={range}
            href={`/dashboard?${params.toString()}`}
            className={cn(
              buttonVariants({
                variant: active ? 'secondary' : 'ghost',
                size: 'sm',
              }),
              'h-7 px-2.5 text-xs'
            )}
          >
            {RANGE_SHORT[range]}
          </Link>
        )
      })}
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClassName,
  href,
}: {
  label: string
  value: number
  hint: string
  icon: ComponentType<{ className?: string }>
  iconClassName: string
  // Destination for the pre-filtered work order list this stat drills into.
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full break-inside-avoid transition-all hover:-translate-y-0.5 hover:ring-foreground/20 hover:shadow-lg dark:hover:ring-foreground/25">
        <div className="flex flex-col gap-2 px-5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-heading text-base font-semibold tracking-tight text-foreground">
              {label}
            </span>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground/5">
              <Icon className={cn('size-[18px]', iconClassName)} />
            </span>
          </div>
          <div className="font-heading text-4xl font-semibold leading-none tracking-tight tabular-nums">
            {value.toLocaleString()}
          </div>
          <p className="text-sm leading-snug text-muted-foreground">{hint}</p>
        </div>
      </Card>
    </Link>
  )
}
