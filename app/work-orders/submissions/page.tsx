import type { Metadata } from 'next'

import { getTimeZone } from '@/lib/datetime/timezone'
import {
  WORK_ORDER_PRIORITIES,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'

import { type QueueBucket, type QueueEntry } from './queue-detail'
import { SubmissionQueue } from './submission-queue'

export const metadata: Metadata = { title: 'Submissions' }

const SUBMISSION_COLUMNS =
  'id, work_order_code, title, category, property, unit_number, priority, due_at, description, reported_by_name, reported_by_email, reported_by_phone, created_at'

type SubmissionRow = {
  id: string
  work_order_code: string
  title: string
  category: WorkOrderCategory
  property: Property | null
  unit_number: string | null
  priority: WorkOrderPriority
  due_at: string | null
  description: string
  reported_by_name: string | null
  reported_by_email: string | null
  reported_by_phone: string | null
  created_at: string
}

// Urgency order (C-within-priority): priority leads, and within a priority the
// due date ascending places overdue items (past-dated) first, then soonest due,
// then no-due-date last. Oldest submission breaks final ties. This is
// clock-independent: an overdue date is always "smaller" than any future date,
// so no current-time read is needed to float overdue work up.
function priorityRank(priority: WorkOrderPriority): number {
  return WORK_ORDER_PRIORITIES.indexOf(priority)
}

function compareQueue(a: QueueEntry, b: QueueEntry): number {
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority)
  if (byPriority !== 0) return byPriority

  if (a.dueAt !== b.dueAt) {
    if (a.dueAt === null) return 1
    if (b.dueAt === null) return -1
    return a.dueAt < b.dueAt ? -1 : 1
  }

  return a.createdAt.localeCompare(b.createdAt)
}

const DAY_MS = 86_400_000

// Kept out of the component body so the clock read isn't flagged as an impure
// call during render (same pattern as computeIsOverdue on the detail page).
function currentTime(): number {
  return Date.now()
}

// Which urgency section a submission belongs to. Urgent work, anything overdue,
// and anything due within three days needs a decision now; the next tier is due
// within the week; the rest has no near-term deadline.
function bucketFor(
  priority: WorkOrderPriority,
  dueAt: string | null,
  now: number
): QueueBucket {
  if (priority === 'urgent') return 'immediate'
  if (dueAt) {
    const diff = new Date(dueAt).getTime() - now
    if (diff <= 3 * DAY_MS) return 'immediate'
    if (diff <= 7 * DAY_MS) return 'soon'
  }
  return 'later'
}

function toEntry(row: SubmissionRow, now: number): QueueEntry {
  return {
    id: row.id,
    workOrderCode: row.work_order_code,
    title: row.title,
    category: row.category,
    priority: row.priority,
    property: row.property,
    unitNumber: row.unit_number,
    description: row.description,
    dueAt: row.due_at,
    reporterName: row.reported_by_name,
    reporterEmail: row.reported_by_email,
    reporterPhone: row.reported_by_phone,
    createdAt: row.created_at,
    bucket: bucketFor(row.priority, row.due_at, now),
  }
}

export default async function SubmissionsPage() {
  const supabase = await createClient()

  const [claimsResult, pendingResult] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from('work_orders')
      .select(SUBMISSION_COLUMNS)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ])

  const userRole = (claimsResult.data?.claims as { user_role?: string } | undefined)
    ?.user_role
  const canModerate = userRole === 'administrator'

  const now = currentTime()
  const pending = ((pendingResult.data ?? []) as SubmissionRow[])
    .map((row) => toEntry(row, now))
    .sort(compareQueue)
  const fetchError = pendingResult.error
  const timeZone = await getTimeZone()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          {canModerate ? 'Approval Queue' : 'Submissions'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canModerate
            ? 'Work orders awaiting your review.'
            : 'Your work orders awaiting administrator approval.'}
        </p>
      </div>

      {fetchError ? (
        <p className="text-sm text-destructive">{fetchError.message}</p>
      ) : null}

      <SubmissionQueue
        pending={pending}
        canModerate={canModerate}
        timeZone={timeZone}
      />
    </div>
  )
}
