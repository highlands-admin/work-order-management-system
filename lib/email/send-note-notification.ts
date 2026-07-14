import { Resend } from 'resend'

import { getSiteUrl } from '@/lib/site-url'

type SendNoteNotificationInput = {
  to: string
  assigneeFirstName?: string | null
  authorName?: string | null
  note: string
  workOrder: { id: string; code: string; title: string }
}

// Emails the assignee that a note on their work order was flagged for their
// attention. Sent on demand when the note's author clicks "Notify assignee".
// Returns an error string instead of throwing so a failed send surfaces as a
// form error rather than crashing the action.
export async function sendNoteNotificationEmail(
  input: SendNoteNotificationInput
): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey) return { error: 'RESEND_API_KEY is not configured.' }
  if (!from) return { error: 'RESEND_FROM_EMAIL is not configured.' }

  const wo = input.workOrder
  const url = `${getSiteUrl()}/work-orders/${wo.id}`
  const greeting = input.assigneeFirstName
    ? `Hi ${input.assigneeFirstName},`
    : 'Hi,'
  const intro = input.authorName
    ? `${input.authorName} flagged a note for your attention on this work order.`
    : 'A note was flagged for your attention on this work order.'

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>A note needs your attention</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;background:#fff;border:1px solid #e4e4e7;border-radius:8px;">
        <tr><td style="padding:32px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:22px;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:22px;">${escapeHtml(intro)}</p>

          <p style="margin:0 0 2px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#0f766e;">${escapeHtml(wo.code)}</p>
          <p style="margin:0 0 16px;font-size:18px;font-weight:600;line-height:24px;">${escapeHtml(wo.title)}</p>

          <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#71717a;">Note</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:21px;white-space:pre-line;color:#3f3f46;">${escapeHtml(input.note)}</p>

          <p style="margin:0;text-align:center;">
            <a href="${url}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">View work order</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = [
    greeting,
    '',
    intro,
    '',
    `${wo.code} — ${wo.title}`,
    '',
    'Note:',
    input.note,
    '',
    `View work order: ${url}`,
  ].join('\n')

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: `A note needs your attention: ${wo.code} - ${wo.title}`,
    html,
    text,
  })

  if (error) return { error: error.message }
  return {}
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
