import { Resend } from 'resend'

import {
  renderWorkOrderAssignmentHtml,
  renderWorkOrderAssignmentText,
} from '@/lib/email/templates/work-order-assignment'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  STATUS_LABELS,
  type Property,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { getSiteUrl } from '@/lib/site-url'

export type AssignmentWorkOrder = {
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
  reporterName: string | null
  reporterEmail: string | null
}

type SendAssignmentInput = {
  to: string
  assigneeFirstName?: string | null
  assignedByName?: string | null
  workOrder: AssignmentWorkOrder
}

export async function sendWorkOrderAssignmentEmail(
  input: SendAssignmentInput
): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey) return { error: 'RESEND_API_KEY is not configured.' }
  if (!from) return { error: 'RESEND_FROM_EMAIL is not configured.' }

  const wo = input.workOrder

  const rows: { label: string; value: string }[] = [
    { label: 'Category', value: CATEGORY_LABELS[wo.category] },
    { label: 'Priority', value: PRIORITY_LABELS[wo.priority] },
    { label: 'Status', value: STATUS_LABELS[wo.status] },
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

  const templateInput = {
    greeting: input.assigneeFirstName ? `Hi ${input.assigneeFirstName},` : 'Hi,',
    intro: input.assignedByName
      ? `${input.assignedByName} assigned a work order to you.`
      : 'A work order has been assigned to you.',
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
    subject: `${wo.code} assigned to you: ${wo.title}`,
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
