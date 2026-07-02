import type { Metadata } from 'next'

import { getTimeZone } from '@/lib/datetime/timezone'
import {
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'

import { ApprovalQueue } from './approval-queue'
import { type SubmissionCardWorkOrder } from './submission-card'

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

  const pending = ((pendingResult.data ?? []) as SubmissionRow[]).map(toCardData)
  const fetchError = pendingResult.error
  const timeZone = await getTimeZone()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
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

      <ApprovalQueue
        pending={pending}
        canModerate={canModerate}
        timeZone={timeZone}
      />
    </div>
  )
}
