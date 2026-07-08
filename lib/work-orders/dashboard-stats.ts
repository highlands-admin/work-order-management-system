import {
  addDays,
  format,
  isSameDay,
  isSameMonth,
  isSameWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'

import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  WORK_ORDER_CATEGORIES,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'

// Categories shown in the "By Category" chart. Preventative Maintenance and
// License/Permit are omitted to keep the axis readable.
const CATEGORY_CHART_KEYS = WORK_ORDER_CATEGORIES.filter(
  (c) => c !== 'preventative_maintenance' && c !== 'license'
)

// Minimal row shape the dashboard needs from work_orders.
export type DashboardRow = {
  status: WorkOrderStatus
  category: WorkOrderCategory
  priority: WorkOrderPriority
  property: Property | null
  due_at: string | null
  assigned_to: string | null
  created_at: string
}

export type DashboardRange = '30d' | '90d' | '365d' | 'all'

export function parseRange(value: string | undefined): DashboardRange {
  return value === '90d' || value === '365d' || value === 'all' ? value : '30d'
}

export const RANGE_LABELS: Record<DashboardRange, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '365d': 'Last 12 months',
  all: 'All time',
}

const ACTIVE_STATUSES = new Set<WorkOrderStatus>(['open', 'in_progress'])
// Statuses that never count as overdue: closed work is done, and on_hold is a
// deliberate pause (waiting on a part, vendor, access) rather than neglect.
const OVERDUE_EXEMPT_STATUSES = new Set<WorkOrderStatus>([
  'done',
  'closed',
  'on_hold',
])

function isOverdue(row: DashboardRow, now: number): boolean {
  if (!row.due_at || OVERDUE_EXEMPT_STATUSES.has(row.status)) return false
  return new Date(row.due_at).getTime() < now
}

export type Slice = { key: string; label: string; value: number }
export type TrendPoint = { label: string; created: number }

// One bar in a stacked breakdown: the group label plus a numeric field per
// status (e.g. open, in_progress) that recharts reads as a stack segment.
export type StatusStackPoint = {
  key: string
  label: string
  total: number
  [status: string]: number | string
}
export type StackedBreakdown = {
  data: StatusStackPoint[]
  statuses: { key: WorkOrderStatus; label: string }[]
}

export type DashboardStats = {
  total: number
  active: number
  overdue: number
  unassigned: number
  pending: number
  byStatus: Slice[]
  byCategory: StackedBreakdown
  byPriority: StackedBreakdown
  trend: TrendPoint[]
}

export function computeDashboardStats(
  rows: DashboardRow[],
  range: DashboardRange,
  // The dashboard's active category filter, if any. The rows passed in are
  // already scoped to it at the query level, but the "By Category" chart's
  // own key list defaults to every category regardless of what's in `rows`
  // (so an unfiltered dashboard still shows a bar for a category with zero
  // work orders) -- when a filter is active, narrow that list to just the
  // selected categories, so filtered-out ones don't still show up as empty
  // bars and labels.
  categoryFilter?: WorkOrderCategory[]
): DashboardStats {
  const now = Date.now()

  let active = 0
  let overdue = 0
  let unassigned = 0
  let pending = 0
  const statusCounts = new Map<string, number>()
  // category/priority -> (status -> count), for the stacked breakdowns.
  const categoryStatus = new Map<string, Map<string, number>>()
  const priorityStatus = new Map<string, Map<string, number>>()

  for (const row of rows) {
    if (ACTIVE_STATUSES.has(row.status)) {
      active += 1
      if (!row.assigned_to) unassigned += 1
    }
    if (row.status === 'pending') pending += 1
    if (isOverdue(row, now)) overdue += 1

    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1)
    bumpStatus(categoryStatus, row.category, row.status)
    bumpStatus(priorityStatus, row.priority, row.status)
  }

  const byStatus: Slice[] = WORK_ORDER_STATUSES.map((s) => ({
    key: s,
    label: STATUS_LABELS[s],
    value: statusCounts.get(s) ?? 0,
  })).filter((s) => s.value > 0)

  const categoryKeys =
    categoryFilter && categoryFilter.length > 0
      ? CATEGORY_CHART_KEYS.filter((c) => categoryFilter.includes(c))
      : CATEGORY_CHART_KEYS

  const byCategory = buildStacked(categoryStatus, categoryKeys, CATEGORY_LABELS)

  const byPriority = buildStacked(
    priorityStatus,
    WORK_ORDER_PRIORITIES,
    PRIORITY_LABELS
  )

  return {
    total: rows.length,
    active,
    overdue,
    unassigned,
    pending,
    byStatus,
    byCategory,
    byPriority,
    trend: buildTrend(rows, range, new Date(now)),
  }
}

function bumpStatus(
  map: Map<string, Map<string, number>>,
  outer: string,
  inner: string
): void {
  let m = map.get(outer)
  if (!m) {
    m = new Map()
    map.set(outer, m)
  }
  m.set(inner, (m.get(inner) ?? 0) + 1)
}

// Turn a group -> (status -> count) map into stacked-bar data. Only statuses
// that appear in at least one group become stack segments, kept in canonical
// status order so colors stay stable.
function buildStacked<K extends string>(
  byKeyStatus: Map<string, Map<string, number>>,
  keys: readonly K[],
  labels: Record<K, string>
): StackedBreakdown {
  const statuses = WORK_ORDER_STATUSES.filter((s) =>
    keys.some((k) => (byKeyStatus.get(k)?.get(s) ?? 0) > 0)
  )

  const data: StatusStackPoint[] = keys.map((k) => {
    const inner = byKeyStatus.get(k)
    const point: StatusStackPoint = { key: k, label: labels[k], total: 0 }
    let total = 0
    for (const s of statuses) {
      const value = inner?.get(s) ?? 0
      point[s] = value
      total += value
    }
    point.total = total
    return point
  })

  return {
    data,
    statuses: statuses.map((s) => ({ key: s, label: STATUS_LABELS[s] })),
  }
}

// Weekly/daily/monthly buckets of work orders created, sized to the range.
function buildTrend(
  rows: DashboardRow[],
  range: DashboardRange,
  now: Date
): TrendPoint[] {
  const config = {
    '30d': { count: 30, unit: 'day' as const },
    '90d': { count: 13, unit: 'week' as const },
    '365d': { count: 12, unit: 'month' as const },
    all: { count: 12, unit: 'month' as const },
  }[range]

  const buckets = Array.from({ length: config.count }, (_, index) => {
    const ago = config.count - 1 - index
    const start =
      config.unit === 'day'
        ? startOfDay(subDays(now, ago))
        : config.unit === 'week'
          ? startOfWeek(subWeeks(now, ago))
          : startOfMonth(subMonths(now, ago))
    // Weekly buckets are labeled as a date range ("Jun 7 - 13") so a week's
    // total is not misread as a single day's count.
    const label =
      config.unit === 'month'
        ? format(start, 'MMM')
        : config.unit === 'week'
          ? formatWeekRange(start)
          : format(start, 'MMM d')
    return { start, label, created: 0 }
  })

  for (const row of rows) {
    const created = new Date(row.created_at)
    if (created.getTime() > now.getTime()) continue
    const bucket = buckets.find((b) =>
      config.unit === 'day'
        ? isSameDay(created, b.start)
        : config.unit === 'week'
          ? isSameWeek(created, b.start)
          : isSameMonth(created, b.start)
    )
    if (bucket) bucket.created += 1
  }

  return buckets.map((b) => ({ label: b.label, created: b.created }))
}

// "Jun 7 - 13" within a month, "Jun 28 - Jul 4" across a month boundary.
function formatWeekRange(start: Date): string {
  const end = addDays(start, 6)
  return isSameMonth(start, end)
    ? `${format(start, 'MMM d')} - ${format(end, 'd')}`
    : `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`
}
