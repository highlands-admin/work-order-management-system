import {
  RiAlarmWarningLine,
  RiPulseLine,
  RiTimeLine,
  RiUserSearchLine,
} from '@remixicon/react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ComponentType } from 'react'

import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import {
  computeDashboardStats,
  parseRange,
  RANGE_LABELS,
  type DashboardRange,
  type DashboardRow,
} from '@/lib/work-orders/dashboard-stats'

import { DashboardCharts } from './dashboard-charts'

export const metadata: Metadata = { title: 'Dashboard · Highlands Cadence' }

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

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('work_orders')
    .select('status, category, priority, property, due_at, assigned_to, created_at')

  if (error) {
    throw new Error(`Failed to load dashboard data: ${error.message}`)
  }

  const rows = (data ?? []) as DashboardRow[]
  const stats = computeDashboardStats(rows, range)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Operations overview across all properties.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeSelector current={range} />
        </div>
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
          label="Pending approval"
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
      />
    </div>
  )
}

function RangeSelector({ current }: { current: DashboardRange }) {
  return (
    <div className="flex items-center rounded-md border p-0.5">
      {RANGE_ORDER.map((range) => {
        const active = range === current
        return (
          <Link
            key={range}
            href={`/dashboard?range=${range}`}
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
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <Icon className={cn('size-4', iconClassName)} />
        </div>
        <CardTitle className="font-heading text-3xl tabular-nums">
          {value.toLocaleString()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
