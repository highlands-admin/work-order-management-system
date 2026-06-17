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

type SendApprovalInput = {
  to: string
  requesterFirstName?: string | null
  approvedByName?: string | null
  workOrder: AssignmentWorkOrder
}

// Emails the requester that their pending submission has been approved and is
// now in the active queue. Returns an error string instead of throwing so a
// failed send never blocks the approval it follows. It reuses the assignment
// email layout; only the greeting, intro, and subject differ.
export async function sendWorkOrderApprovedEmail(
  input: SendApprovalInput
): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey) return { error: 'RESEND_API_KEY is not configured.' }
  if (!from) return { error: 'RESEND_FROM_EMAIL is not configured.' }

  const wo = input.workOrder

  const rows: { label: string; value: string }[] = [
    { label: 'Category', value: CATEGORY_LABELS[wo.category] },
    { label: 'Priority', value: PRIORITY_LABELS[wo.priority] },
  ]
  if (wo.property) {
    rows.push({ label: 'Property', value: PROPERTY_LABELS[wo.property] })
  }
  if (wo.unitNumber) rows.push({ label: 'Unit', value: wo.unitNumber })
  if (wo.dueAt) rows.push({ label: 'Due', value: formatDateTime(wo.dueAt) })

  const templateInput = {
    greeting: input.requesterFirstName
      ? `Hi ${input.requesterFirstName},`
      : 'Hi,',
    intro: input.approvedByName
      ? `${input.approvedByName} approved your work order. It is now open and in the active queue.`
      : 'Your work order has been approved. It is now open and in the active queue.',
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
    subject: `Approved: ${wo.code} - ${wo.title}`,
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
