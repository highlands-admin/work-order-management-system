import { NextResponse, type NextRequest } from 'next/server'

import { sendRecurrenceReminderEmail } from '@/lib/email/send-recurrence-reminder'
import {
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { createAdminClient } from '@/lib/supabase/admin'

// Triggered daily by pg_cron via pg_net (see the schedule_recurring_jobs
// migration). It emails a reminder for every recurring occurrence inside its
// reminder window that has not been reminded yet, then stamps reminder_sent_at
// so each occurrence is only ever emailed once. The caller is authenticated with
// a shared secret because this runs with the service role and bypasses RLS.

type ReminderRow = {
  id: string
  work_order_code: string
  title: string
  category: WorkOrderCategory
  priority: WorkOrderPriority
  status: WorkOrderStatus
  property: Property | null
  unit_number: string | null
  due_at: string | null
  description: string
  provider: string | null
  recipient_email: string | null
  recipient_name: string | null
}

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured.' },
      { status: 500 }
    )
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc(
    'recurring_work_orders_due_for_reminder'
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as ReminderRow[]
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const row of rows) {
    // A generated occurrence always has a creator, so a missing recipient email
    // means the user has no address on file; skip rather than fail the batch.
    if (!row.recipient_email) {
      skipped += 1
      continue
    }

    const { error: sendError } = await sendRecurrenceReminderEmail({
      to: row.recipient_email,
      recipientFirstName: row.recipient_name,
      workOrder: {
        id: row.id,
        code: row.work_order_code,
        title: row.title,
        category: row.category,
        priority: row.priority,
        status: row.status,
        property: row.property,
        unitNumber: row.unit_number,
        dueAt: row.due_at,
        description: row.description,
        provider: row.provider,
      },
    })

    if (sendError) {
      // Leave reminder_sent_at unset so the next run retries this occurrence.
      failed += 1
      continue
    }

    const { error: stampError } = await supabase
      .from('work_orders')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', row.id)

    if (stampError) {
      failed += 1
      continue
    }
    sent += 1
  }

  return NextResponse.json({ processed: rows.length, sent, failed, skipped })
}
