import type { Metadata } from 'next'

import { getTimeZone } from '@/lib/datetime/timezone'
import {
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'

import { SubmissionCard, type SubmissionCardWorkOrder } from './submission-card'

export const metadata: Metadata = { title: 'Submissions' }

const SUBMISSION_COLUMNS =
  'id, work_order_code, title, status, category, property, unit_number, priority, due_at, description, reported_by_name, reported_by_email, reported_by_phone, rejected_reason, rejected_at, created_at'

type SubmissionRow = {
  id: string
  work_order_code: string
  title: string
  status: 'pending' | 'rejected'
  category: WorkOrderCategory
  property: Property | null
  unit_number: string | null
  priority: WorkOrderPriority
  due_at: string | null
  description: string
  reported_by_name: string | null
  reported_by_email: string | null
  reported_by_phone: string | null
  rejected_reason: string | null
  rejected_at: string | null
  created_at: string
}

function toCardData(row: SubmissionRow): SubmissionCardWorkOrder {
  return {
    id: row.id,
    workOrderCode: row.work_order_code,
    title: row.title,
    status: row.status,
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
    rejectedReason: row.rejected_reason,
    rejectedAt: row.rejected_at,
  }
}

export default async function SubmissionsPage() {
  const supabase = await createClient()

  // Two parallel queries keep the rejection list on its own ordering (most
  // recently rejected first) without complicating the pending sort.
  const [claimsResult, pendingResult, rejectedResult] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from('work_orders')
      .select(SUBMISSION_COLUMNS)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('work_orders')
      .select(SUBMISSION_COLUMNS)
      .eq('status', 'rejected')
      .order('rejected_at', { ascending: false, nullsFirst: false })
      .limit(50),
  ])

  const userRole = (claimsResult.data?.claims as { user_role?: string } | undefined)
    ?.user_role
  const canModerate = userRole === 'administrator'

  const pending = ((pendingResult.data ?? []) as SubmissionRow[]).map(toCardData)
  const rejected = ((rejectedResult.data ?? []) as SubmissionRow[]).map(toCardData)
  const fetchError = pendingResult.error ?? rejectedResult.error
  const timeZone = await getTimeZone()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {canModerate ? 'Approval Queue' : 'Submissions'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {canModerate
              ? 'Work orders awaiting your review, plus recent rejections.'
              : 'Your work orders awaiting administrator approval.'}
          </p>
        </div>
        {pending.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {pending.length} pending
          </span>
        ) : null}
      </div>

      {fetchError ? (
        <p className="text-sm text-destructive">{fetchError.message}</p>
      ) : null}

      <section className="flex flex-col gap-4">
        <SectionHeading title="Pending review" count={pending.length} />
        {pending.length === 0 ? (
          <EmptyState>
            {canModerate
              ? 'Nothing to review right now.'
              : 'No submissions awaiting review.'}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.map((wo) => (
              <SubmissionCard
                key={wo.id}
                workOrder={wo}
                canModerate={canModerate}
                timeZone={timeZone}
              />
            ))}
          </div>
        )}
      </section>

      {rejected.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeading title="Recently rejected" count={rejected.length} />
          <div className="flex flex-col gap-4">
            {rejected.map((wo) => (
              <SubmissionCard
                key={wo.id}
                workOrder={wo}
                canModerate={canModerate}
                timeZone={timeZone}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-card p-6">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
