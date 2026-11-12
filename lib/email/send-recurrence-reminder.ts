import { bareAddress, buildDueDateInvite } from '@/lib/email/calendar-invite'
import { createEmailClient } from '@/lib/email/resend-client'

import {
  renderWorkOrderAssignmentHtml,
  renderWorkOrderAssignmentText,
} from '@/lib/email/templates/work-order-assignment'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  REMINDER_LEAD_LABELS,
  STATUS_LABELS,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { getSiteUrl } from '@/lib/site-url'

export type ReminderWorkOrder = {
  id: string
  code: string
  title: string
  category: WorkOrderCategory
  priority: WorkOrderPriority
  status: WorkOrderStatus
  property: Property | null
  // Display name for property, resolved by the caller because the name is
  // per organization.
  propertyName: string | null
  unitNumber: string | null
  dueAt: string | null
  description: string
  provider: string | null
}

type SendReminderInput = {
  to: string
  recipientFirstName?: string | null
  // Which alert this is (days before due), for the email's "Alert" detail line.
  leadDays?: number
  workOrder: ReminderWorkOrder
}

// Reminds the recipient that a recurring inspection or license is coming due. It
// reuses the assignment email layout so both notifications look the same; only
// the greeting, intro, and subject change.
export async function sendRecurrenceReminderEmail(
  input: SendReminderInput
): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey) return { error: 'RESEND_API_KEY is not configured.' }
  if (!from) return { error: 'RESEND_FROM_EMAIL is not configured.' }

  const wo = input.workOrder
  const dueText = wo.dueAt ? formatDate(wo.dueAt) : 'soon'
  const overdue = wo.dueAt ? new Date(wo.dueAt).getTime() < Date.now() : false
  const url = `${getSiteUrl()}/work-orders/${wo.id}`

  const rows: { label: string; value: string }[] = [
    { label: 'Category', value: CATEGORY_LABELS[wo.category] },
    { label: 'Priority', value: PRIORITY_LABELS[wo.priority] },
    { label: 'Status', value: STATUS_LABELS[wo.status] },
  ]
  if (wo.property) {
    rows.push({ label: 'Property', value: wo.propertyName ?? wo.property })
  }
  if (wo.unitNumber) rows.push({ label: 'Unit', value: wo.unitNumber })
  if (wo.provider) rows.push({ label: 'Provider', value: wo.provider })
  if (wo.dueAt) rows.push({ label: 'Due', value: formatDateTime(wo.dueAt) })
  if (input.leadDays !== undefined) {
    rows.push({
      label: 'Alert',
      value:
        REMINDER_LEAD_LABELS[input.leadDays] ?? `${input.leadDays} days before`,
    })
  }

  const templateInput = {
    greeting: input.recipientFirstName ? `Hi ${input.recipientFirstName},` : 'Hi,',
    intro: overdue
      ? `This item was due ${dueText} and is overdue. Please get it done and close the work order. A reminder is on your calendar for tomorrow at 9 AM.`
      : `This item is due ${dueText}. Please schedule it before the due date. It is on your calendar for 9 AM that day.`,
    code: wo.code,
    title: wo.title,
    rows,
    description: wo.description,
    url,
  }

  // A calendar invite for the due date, so the item lands on the recipient's
  // calendar even if they never open Workflow 360.
  const attachments = wo.dueAt
    ? [
        {
          filename: 'invite.ics',
          contentType: 'text/calendar; charset=utf-8; method=REQUEST',
          content: Buffer.from(
            buildDueDateInvite({
              workOrderId: wo.id,
              code: wo.code,
              title: wo.title,
              propertyName: wo.propertyName,
              description: wo.description,
              dueAt: wo.dueAt,
              url,
              organizerEmail: bareAddress(from),
              attendeeEmail: input.to,
            })
          ),
        },
      ]
    : undefined

  const resend = createEmailClient(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: `${overdue ? 'Overdue' : 'Reminder'}: ${wo.code} ${wo.title}${
      wo.propertyName ? ` (${wo.propertyName})` : ''
    } due ${dueText}`,
    html: renderWorkOrderAssignmentHtml(templateInput),
    text: renderWorkOrderAssignmentText(templateInput),
    attachments,
  })

  if (error) return { error: error.message }
  return {}
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    dateStyle: 'medium',
    timeZone: 'America/New_York',
  })
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    // The server runs in UTC; the communities read Eastern time.
    timeZone: 'America/New_York',
  })
}
