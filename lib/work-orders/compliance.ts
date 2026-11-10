import {
  FREQUENCY_LABELS,
  type RecurrenceFrequency,
  type WorkOrderCategory,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'

// The categories the State Compliance page tracks, in display order.
export const COMPLIANCE_CATEGORIES = [
  'license',
  'compliance',
] as const satisfies readonly WorkOrderCategory[]

// How far ahead a due date counts as "due soon".
export const DUE_SOON_DAYS = 30

export type ComplianceStatus = 'overdue' | 'due_soon' | 'current' | 'no_record'

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  current: 'Current',
  no_record: 'No record',
}

// Worst first, so a community's summary and sorting lead with what needs action.
export const COMPLIANCE_STATUS_ORDER: ComplianceStatus[] = [
  'overdue',
  'due_soon',
  'no_record',
  'current',
]

export const COMPLIANCE_STATUS_COLOR: Record<ComplianceStatus, string> = {
  overdue: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  due_soon: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  current:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  no_record: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700/30 dark:text-zinc-300',
}

// Statuses of an occurrence that is still waiting to be finished.
const OPEN_STATUSES = new Set<WorkOrderStatus>([
  'pending',
  'open',
  'in_progress',
  'on_hold',
  'done',
])

export type ComplianceOccurrence = {
  id: string
  status: WorkOrderStatus
  due_at: string | null
  closed_at: string | null
}

export type ComplianceSchedule = {
  id: string
  title: string
  category: WorkOrderCategory
  property: string | null
  provider: string | null
  description: string
  frequency: RecurrenceFrequency
  recurrence_interval: number
  next_due_at: string | null
  last_completed_on: string | null
  active: boolean
}

export type ComplianceItem = {
  schedule: ComplianceSchedule
  lastDone: string | null
  nextDue: string | null
  // The occurrence someone should act on now, if one has been generated.
  openWorkOrderId: string | null
  status: ComplianceStatus
}

// "Annual", or "Every 2 years" when the schedule skips intervals.
export function complianceFrequencyLabel(
  frequency: RecurrenceFrequency,
  interval: number
): string {
  if (interval <= 1) return FREQUENCY_LABELS[frequency]
  switch (frequency) {
    case 'weekly':
      return `Every ${interval} weeks`
    case 'monthly':
      return `Every ${interval} months`
    case 'quarterly':
      return `Every ${interval * 3} months`
    case 'semiannual':
      return `Every ${interval * 6} months`
    case 'annual':
      return `Every ${interval} years`
    default:
      return FREQUENCY_LABELS[frequency]
  }
}

// The calendar date (YYYY-MM-DD) of an instant in the given time zone, so due
// dates compare by the community's day rather than by UTC.
export function calendarDate(value: string, timeZone: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

// "Nov 10, 2026" for a calendar date, without the time zone shift that
// formatting a bare YYYY-MM-DD as an instant would cause.
export function formatCalendarDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return next.toISOString().slice(0, 10)
}

// Works out one schedule's compliance state from its own fields and its
// generated work orders.
//
// Last done: the latest closed occurrence, falling back to the completion date
// recorded before the schedule was tracked in the app.
// Next due: the earliest occurrence still open, else the schedule's next
// generation date while it is active.
export function toComplianceItem(
  schedule: ComplianceSchedule,
  occurrences: ComplianceOccurrence[],
  today: string,
  timeZone: string
): ComplianceItem {
  let lastDone: string | null = schedule.last_completed_on
  let openDue: string | null = null
  let openWorkOrderId: string | null = null

  for (const o of occurrences) {
    if (o.status === 'closed' && o.closed_at) {
      const closed = calendarDate(o.closed_at, timeZone)
      if (!lastDone || closed > lastDone) lastDone = closed
    } else if (OPEN_STATUSES.has(o.status) && o.due_at) {
      const due = calendarDate(o.due_at, timeZone)
      if (!openDue || due < openDue) {
        openDue = due
        openWorkOrderId = o.id
      }
    }
  }

  const nextDue =
    openDue ??
    (schedule.active && schedule.next_due_at
      ? calendarDate(schedule.next_due_at, timeZone)
      : null)

  let status: ComplianceStatus
  if (nextDue && nextDue < today) status = 'overdue'
  else if (nextDue && nextDue <= addDays(today, DUE_SOON_DAYS)) status = 'due_soon'
  else if (lastDone || nextDue) status = 'current'
  else status = 'no_record'

  return { schedule, lastDone, nextDue, openWorkOrderId, status }
}
