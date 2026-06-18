import { Resend } from 'resend'

import {
  renderWorkOrderAssignmentHtml,
  renderWorkOrderAssignmentText,
} from '@/lib/email/templates/work-order-assignment'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
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

  const rows: { label: string; value: string }[] = [
    { label: 'Category', value: CATEGORY_LABELS[wo.category] },
    { label: 'Priority', value: PRIORITY_LABELS[wo.priority] },
    { label: 'Status', value: STATUS_LABELS[wo.status] },
  ]
  if (wo.property) {
    rows.push({ label: 'Property', value: PROPERTY_LABELS[wo.property] })
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
    intro: `This recurring work order is due ${dueText}. Please schedule it before the due date.`,
    code: wo.code,
    title: wo.title,
    rows,
    description: wo.description,
    url: `${getSiteUrl()}/work-orders/${wo.id}`,
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: `Reminder: ${wo.code} ${wo.title} due ${dueText}`,
    html: renderWorkOrderAssignmentHtml(templateInput),
    text: renderWorkOrderAssignmentText(templateInput),
  })

  if (error) return { error: error.message }
  return {}
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' })
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
