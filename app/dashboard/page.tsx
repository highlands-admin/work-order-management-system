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
import { Card } from '@/components/ui/card'
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
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-base text-muted-foreground">
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
