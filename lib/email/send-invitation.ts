import { Resend } from 'resend'

import {
  renderInvitationHtml,
  renderInvitationText,
} from '@/lib/email/templates/invitation'
import { ROLE_LABELS, type AppRole } from '@/lib/schemas/admin'
import { getSiteUrl } from '@/lib/site-url'

type SendInvitationInput = {
  to: string
  token: string
  role: AppRole
  firstName?: string | null
  invitedByName?: string | null
}

export async function sendInvitationEmail(
  input: SendInvitationInput
): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey) return { error: 'RESEND_API_KEY is not configured.' }
  if (!from) return { error: 'RESEND_FROM_EMAIL is not configured.' }

  const acceptUrl = `${getSiteUrl()}/accept-invite?token=${encodeURIComponent(
    input.token
  )}`
  const templateInput = {
    acceptUrl,
    roleLabel: ROLE_LABELS[input.role],
    greeting: input.firstName ? `Hi ${input.firstName},` : 'Hi,',
    invitedBy: input.invitedByName
      ? `${input.invitedByName} has invited you`
      : 'You have been invited',
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: `You have been invited to Work Orders`,
    html: renderInvitationHtml(templateInput),
    text: renderInvitationText(templateInput),
  })

  if (error) return { error: error.message }
  return {}
}
