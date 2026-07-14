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

type SendRejectionInput = {
  to: string
  requesterFirstName?: string | null
  rejectedByName?: string | null
  reason: string
  workOrder: AssignmentWorkOrder
}

// Emails the requester that their work order was rejected, and why. Returns an
// error string instead of throwing so a failed send never blocks the rejection
// it follows. It reuses the assignment email layout; the reason leads the
// detail rows so it is the first thing read.
export async function sendWorkOrderRejectedEmail(
  input: SendRejectionInput
): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey) return { error: 'RESEND_API_KEY is not configured.' }
  if (!from) return { error: 'RESEND_FROM_EMAIL is not configured.' }

  const wo = input.workOrder

  const rows: { label: string; value: string }[] = [
    { label: 'Reason', value: input.reason },
    { label: 'Category', value: CATEGORY_LABELS[wo.category] },
    { label: 'Priority', value: PRIORITY_LABELS[wo.priority] },
  ]
  if (wo.property) {
    rows.push({ label: 'Property', value: PROPERTY_LABELS[wo.property] })
  }
  if (wo.unitNumber) rows.push({ label: 'Unit', value: wo.unitNumber })

  const templateInput = {
    greeting: input.requesterFirstName
      ? `Hi ${input.requesterFirstName},`
      : 'Hi,',
    intro: input.rejectedByName
      ? `${input.rejectedByName} rejected your work order. See the reason below.`
      : 'Your work order has been rejected. See the reason below.',
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
    subject: `Rejected: ${wo.code} - ${wo.title}`,
    html: renderWorkOrderAssignmentHtml(templateInput),
    text: renderWorkOrderAssignmentText(templateInput),
  })

  if (error) return { error: error.message }
  return {}
}
