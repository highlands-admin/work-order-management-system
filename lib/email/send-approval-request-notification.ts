import { Resend } from 'resend'

import { type AssignmentWorkOrder } from '@/lib/email/send-assignment-notification'
import {
  renderWorkOrderAssignmentHtml,
  renderWorkOrderAssignmentText,
} from '@/lib/email/templates/work-order-assignment'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
} from '@/lib/schemas/work-order'
import { getSiteUrl } from '@/lib/site-url'

type SendApprovalRequestInput = {
  to: string
  approverName?: string | null
  submittedByName?: string | null
  workOrder: AssignmentWorkOrder
}

// Emails the category approver that a work order is waiting in the approval
// queue. Returns an error string instead of throwing so a failed send never
// blocks the work order creation it follows.
export async function sendApprovalRequestEmail(
  input: SendApprovalRequestInput
): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey) return { error: 'RESEND_API_KEY is not configured.' }
  if (!from) return { error: 'RESEND_FROM_EMAIL is not configured.' }

  const wo = input.workOrder
  const categoryLabel = CATEGORY_LABELS[wo.category]

  const rows: { label: string; value: string }[] = [
    { label: 'Category', value: categoryLabel },
    { label: 'Priority', value: PRIORITY_LABELS[wo.priority] },
  ]
  if (wo.property) {
    rows.push({ label: 'Property', value: PROPERTY_LABELS[wo.property] })
  }
  if (wo.unitNumber) rows.push({ label: 'Unit', value: wo.unitNumber })
  if (wo.dueAt) rows.push({ label: 'Due', value: formatDateTime(wo.dueAt) })

  const reporter = [wo.reporterName, wo.reporterEmail]
    .filter(Boolean)
    .join(' · ')
  if (reporter) rows.push({ label: 'Reporter', value: reporter })

  const firstName = input.approverName?.trim().split(/\s+/)[0]

  const templateInput = {
    greeting: firstName ? `Hi ${firstName},` : 'Hi,',
    intro: input.submittedByName
      ? `${input.submittedByName} submitted a ${categoryLabel} work order that is awaiting your approval.`
      : `A ${categoryLabel} work order is awaiting your approval.`,
    code: wo.code,
    title: wo.title,
    rows,
    description: wo.description,
    // Land them in the approval queue, where the approve and reject actions are.
    url: `${getSiteUrl()}/work-orders/submissions`,
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: `Approval Needed: ${wo.code} - ${wo.title}`,
    html: renderWorkOrderAssignmentHtml(templateInput),
    text: renderWorkOrderAssignmentText(templateInput),
  })

  if (error) return { error: error.message }
  return {}
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
