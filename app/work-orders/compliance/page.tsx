import type { Metadata } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getTimeZone } from '@/lib/datetime/timezone'
import { CATEGORY_LABELS } from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import {
  calendarDate,
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_STATUS_COLOR,
  COMPLIANCE_STATUS_LABELS,
  COMPLIANCE_STATUS_ORDER,
  complianceFrequencyLabel,
  dueDistanceLabel,
  formatCalendarDate,
  toComplianceItem,
  type ComplianceItem,
  type ComplianceOccurrence,
  type ComplianceSchedule,
  type ComplianceStatus,
} from '@/lib/work-orders/compliance'
import { getProperties } from '@/lib/work-orders/fetch-properties'

export const metadata: Metadata = { title: 'State Compliance' }

const SCHEDULE_COLUMNS =
  'id, title, category, property, provider, description, frequency, recurrence_interval, next_due_at, last_completed_on, active, generation_lead_days'

type OccurrenceRow = ComplianceOccurrence & { recurring_work_order_id: string }

function StatusPill({ status }: { status: ComplianceStatus }) {
  return (
    <Badge className={COMPLIANCE_STATUS_COLOR[status]}>
      {COMPLIANCE_STATUS_LABELS[status]}
    </Badge>
  )
}

// Imported schedules describe themselves ("Annual Fire Drills at Rome.") and
// carry the community's own remarks after "Tracker notes:". The row already
// shows the item and community, so only the remarks are worth repeating.
function trackerNotes(description: string): string | null {
  const marker = 'Tracker notes:'
  const at = description.indexOf(marker)
  return at === -1 ? null : description.slice(at + marker.length).trim()
}

// What happens next for an item's work order: a link when one is open,
// otherwise when the schedule will create it, or a prompt to add a date.
function WorkOrderLink({
  item,
  today,
}: {
  item: ComplianceItem
  today: string
}) {
  if (item.openWorkOrderId) {
    return (
      <Link
        href={`/work-orders/${item.openWorkOrderId}`}
        className="font-medium text-primary hover:underline"
      >
        Open work order
      </Link>
    )
  }
  if (item.workOrderOpensOn) {
    // Already past its creation date: the daily 9 AM job creates it next.
    return (
      <span className="text-muted-foreground">
        {item.workOrderOpensOn <= today
          ? 'On the next daily run'
          : `Opens ${formatCalendarDate(item.workOrderOpensOn)}`}
      </span>
    )
  }
  if (item.status === 'no_record') {
    return <span className="text-muted-foreground">Needs a date</span>
  }
  return <span className="text-muted-foreground">None scheduled</span>
}

function countByStatus(items: ComplianceItem[]): Record<ComplianceStatus, number> {
  const counts: Record<ComplianceStatus, number> = {
    overdue: 0,
    due_soon: 0,
    current: 0,
    no_record: 0,
  }
  for (const item of items) counts[item.status] += 1
  return counts
}

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const timeZone = await getTimeZone()

  const [properties, schedulesResult] = await Promise.all([
    getProperties(),
    supabase
      .from('recurring_work_orders')
      .select(SCHEDULE_COLUMNS)
      .in('category', [...COMPLIANCE_CATEGORIES])
      .order('title'),
  ])

  const schedules = (schedulesResult.data ?? []) as ComplianceSchedule[]
  const scheduleIds = schedules.map((s) => s.id)

  // Every generated occurrence of these schedules: the open ones give the next
  // due date, the closed ones the last completion.
  const occurrencesResult =
    scheduleIds.length > 0
      ? await supabase
          .from('work_orders')
          .select('id, status, due_at, closed_at, recurring_work_order_id')
          .in('recurring_work_order_id', scheduleIds)
      : { data: [], error: null }

  const occurrencesBySchedule = new Map<string, ComplianceOccurrence[]>()
  for (const row of (occurrencesResult.data ?? []) as OccurrenceRow[]) {
    const list = occurrencesBySchedule.get(row.recurring_work_order_id) ?? []
    list.push(row)
    occurrencesBySchedule.set(row.recurring_work_order_id, list)
  }

  const today = calendarDate(new Date().toISOString(), timeZone)
  const items = schedules.map((s) =>
    toComplianceItem(s, occurrencesBySchedule.get(s.id) ?? [], today, timeZone)
  )

  // Communities that have compliance items, in the organization's order.
  const communities = properties.filter((p) =>
    items.some((i) => i.schedule.property === p.key)
  )
  const requested = typeof params.community === 'string' ? params.community : null
  const selected =
    communities.find((c) => c.key === requested) ?? communities[0] ?? null
  const selectedItems = selected
    ? items.filter((i) => i.schedule.property === selected.key)
    : []

  const error = schedulesResult.error ?? occurrencesResult.error

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">State Compliance</h1>
        <p className="text-sm text-muted-foreground">
          Every license, permit, and inspection each community must keep
          current. Items come from the License/Permit and Compliance/Inspection
          recurring schedules, and update as their work orders are closed.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}

      {communities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No compliance schedules yet. Create a recurring schedule in the
          License/Permit or Compliance/Inspection category to track it here.
        </p>
      ) : (
        <>
          {/* One card per community: how many items need attention. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {communities.map((c) => {
              const counts = countByStatus(
                items.filter((i) => i.schedule.property === c.key)
              )
              const isSelected = c.key === selected?.key
              return (
                <Link
                  key={c.key}
                  href={`/work-orders/compliance?community=${c.key}`}
                  aria-current={isSelected ? 'page' : undefined}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40',
                    isSelected && 'ring-2 ring-primary'
                  )}
                >
                  <span className="font-medium">{c.name}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {COMPLIANCE_STATUS_ORDER.filter((s) => counts[s] > 0).map(
                      (s) => (
                        <Badge key={s} className={COMPLIANCE_STATUS_COLOR[s]}>
                          {counts[s]} {COMPLIANCE_STATUS_LABELS[s]}
                        </Badge>
                      )
                    )}
                  </div>
                </Link>
              )
            })}
          </div>

          {selected ? (
            <div className="flex flex-col gap-6">
              <h2 className="font-heading text-xl font-semibold">
                {selected.name}
              </h2>
              {COMPLIANCE_CATEGORIES.map((category) => {
                const rows = selectedItems
                  .filter((i) => i.schedule.category === category)
                  .sort(
                    (a, b) =>
                      COMPLIANCE_STATUS_ORDER.indexOf(a.status) -
                        COMPLIANCE_STATUS_ORDER.indexOf(b.status) ||
                      a.schedule.title.localeCompare(b.schedule.title)
                  )
                if (rows.length === 0) return null
                return (
                  <section key={category} className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      {CATEGORY_LABELS[category]}
                    </h3>
                    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            {[
                              'Item',
                              'Provider',
                              'Frequency',
                              'Last Done',
                              'Next Due',
                              'Status',
                              'Work Order',
                            ].map((label) => (
                              <TableHead
                                key={label}
                                className="px-4 text-xs uppercase tracking-wide text-muted-foreground"
                              >
                                {label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((item) => (
                            <TableRow
                              key={item.schedule.id}
                              className={cn(
                                item.status === 'overdue' &&
                                  'bg-rose-50 hover:bg-rose-100/70 dark:bg-rose-950/30 dark:hover:bg-rose-950/50'
                              )}
                            >
                              <TableCell
                                className={cn(
                                  'px-4 py-3 align-top',
                                  item.status === 'overdue' &&
                                    'border-l-4 border-l-rose-500'
                                )}
                              >
                                <div className="font-medium">
                                  {item.schedule.title}
                                </div>
                                {trackerNotes(item.schedule.description) ? (
                                  <div className="mt-0.5 max-w-sm whitespace-normal text-xs text-muted-foreground">
                                    {trackerNotes(item.schedule.description)}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell className="px-4 py-3 align-top">
                                {item.schedule.provider ?? '—'}
                              </TableCell>
                              <TableCell className="px-4 py-3 align-top">
                                {complianceFrequencyLabel(
                                  item.schedule.frequency,
                                  item.schedule.recurrence_interval
                                )}
                              </TableCell>
                              <TableCell className="px-4 py-3 align-top">
                                {item.lastDone
                                  ? formatCalendarDate(item.lastDone)
                                  : '—'}
                              </TableCell>
                              <TableCell className="px-4 py-3 align-top">
                                {item.nextDue
                                  ? formatCalendarDate(item.nextDue)
                                  : '—'}
                                {item.daysUntilDue !== null &&
                                (item.status === 'overdue' ||
                                  item.status === 'due_soon') ? (
                                  <div
                                    className={cn(
                                      'mt-0.5 text-xs font-semibold',
                                      item.status === 'overdue'
                                        ? 'text-rose-700 dark:text-rose-300'
                                        : 'text-amber-700 dark:text-amber-300'
                                    )}
                                  >
                                    {dueDistanceLabel(item.daysUntilDue)}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell className="px-4 py-3 align-top">
                                <StatusPill status={item.status} />
                              </TableCell>
                              <TableCell className="px-4 py-3 text-right align-top">
                                <div className="flex flex-col items-end gap-1 text-sm">
                                  <WorkOrderLink item={item} today={today} />
                                  <Link
                                    href={`/work-orders/recurring/${item.schedule.id}/edit`}
                                    className="text-muted-foreground hover:underline"
                                  >
                                    Edit schedule
                                  </Link>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                )
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
