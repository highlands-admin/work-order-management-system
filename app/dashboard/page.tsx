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
import type { WorkOrderCategory } from '@/lib/schemas/work-order'
import {
  DASHBOARD_CATEGORY_COOKIE,
  parseCategoryList,
} from '@/lib/work-orders/dashboard-filters-cookie'
import {
  computeDashboardStats,
  parseRange,
  RANGE_LABELS,
  type DashboardRange,
  type DashboardRow,
} from '@/lib/work-orders/dashboard-stats'

import { DashboardCategoryFilter } from './category-filter'
import { DashboardCharts } from './dashboard-charts'

export const metadata: Metadata = { title: 'Dashboard · Cadence' }

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

  // An explicit ?category always wins (even empty, meaning "explicitly
  // cleared"); otherwise, on a visit that carries none, fall back to the
  // persisted cookie -- same no-redirect resolution as the work-order list
  // filters, so there's no extra round trip or flash of the unfiltered view.
  let categories: WorkOrderCategory[]
  if ('category' in params) {
    const raw = Array.isArray(params.category) ? params.category[0] : params.category
    categories = parseCategoryList(raw)
  } else {
    const cookieStore = await cookies()
    categories = parseCategoryList(cookieStore.get(DASHBOARD_CATEGORY_COOKIE)?.value)
  }

  const supabase = await createClient()
  let query = supabase
    .from('work_orders')
    .select('status, category, priority, property, due_at, assigned_to, created_at')
  if (categories.length > 0) {
    query = query.in('category', categories)
  }
  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to load dashboard data: ${error.message}`)
  }

  const rows = (data ?? []) as DashboardRow[]
  const stats = computeDashboardStats(rows, range, categories)
  const categoryParam = categories.join(',')

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-base text-muted-foreground">
            Operations overview across all facilities.
          </p>
        </div>
        <DashboardCategoryFilter selected={categories} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active"
          value={stats.active}
          hint="Open and in progress"
          icon={RiPulseLine}
          iconClassName="text-sky-500"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          hint="Past due, not closed"
          icon={RiAlarmWarningLine}
          iconClassName="text-rose-500"
        />
        <StatCard
          label="Unassigned"
          value={stats.unassigned}
          hint="Active without an assignee"
          icon={RiUserSearchLine}
          iconClassName="text-amber-500"
        />
        <StatCard
          label="Pending Approval"
          value={stats.pending}
          hint="Awaiting review"
          icon={RiTimeLine}
          iconClassName="text-violet-500"
        />
      </div>

      <DashboardCharts
        byStatus={stats.byStatus}
        byCategory={stats.byCategory}
        byPriority={stats.byPriority}
        trend={stats.trend}
        rangeLabel={RANGE_LABELS[range]}
        rangeSelector={
          <RangeSelector current={range} categoryParam={categoryParam} />
        }
      />
    </div>
  )
}

function RangeSelector({
  current,
  categoryParam,
}: {
  current: DashboardRange
  // Carried along so switching ranges doesn't drop the category filter --
  // this is a plain server-rendered Link, not a client component that could
  // read the current URL itself.
  categoryParam: string
}) {
  return (
    <div className="flex items-center rounded-md border p-0.5">
      {RANGE_ORDER.map((range) => {
        const active = range === current
        const params = new URLSearchParams({ range })
        if (categoryParam) params.set('category', categoryParam)
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
}: {
  label: string
  value: number
  hint: string
  icon: ComponentType<{ className?: string }>
  iconClassName: string
}) {
  return (
    <Card className="break-inside-avoid">
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
  )
}
