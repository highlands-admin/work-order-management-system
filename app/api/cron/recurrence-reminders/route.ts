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
// migration). The RPC returns one row per (occurrence, alert lead time) that is
// due and not yet sent, with the schedule's recipient list. For each, it emails
// every recipient and records the alert as sent so it never repeats. The caller
// is authenticated with a shared secret because this runs with the service role
// and bypasses RLS.

type Recipient = { email: string | null; first_name: string | null }

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
  lead_days: number
  recipients: Recipient[]
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
  let emailsSent = 0
  let emailsFailed = 0
  let skipped = 0

  for (const row of rows) {
    const recipients = (row.recipients ?? []).filter((r) => r.email)
    if (recipients.length === 0) {
      skipped += 1
      continue
    }

    const workOrder = {
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
    }

    for (const recipient of recipients) {
      const { error: sendError } = await sendRecurrenceReminderEmail({
        to: recipient.email as string,
        recipientFirstName: recipient.first_name,
        leadDays: row.lead_days,
        workOrder,
      })
      if (sendError) {
        emailsFailed += 1
        console.error('Recurrence reminder send failed', {
          workOrder: row.id,
          leadDays: row.lead_days,
          to: recipient.email,
          error: sendError,
        })
      } else {
        emailsSent += 1
      }
    }

    // Mark this alert as sent for the occurrence so it never repeats, even if a
    // recipient failed (logged above), to avoid re-emailing the rest.
    const { error: recordError } = await supabase.rpc('record_reminder_sent', {
      p_work_order_id: row.id,
      p_lead_days: row.lead_days,
    })
    if (recordError) {
      console.error('record_reminder_sent failed', {
        workOrder: row.id,
        error: recordError.message,
      })
    }
  }

  return NextResponse.json({
    alerts: rows.length,
    emailsSent,
    emailsFailed,
    skipped,
  })
}
