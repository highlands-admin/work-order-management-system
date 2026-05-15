// Invitation email body. HTML and plain-text are kept side by side so they
// stay in sync; Resend uses both (text/html and text/plain MIME parts).

type InvitationTemplateInput = {
  greeting: string
  invitedBy: string
  roleLabel: string
  acceptUrl: string
}

export function renderInvitationHtml({
  greeting,
  invitedBy,
  roleLabel,
  acceptUrl,
}: InvitationTemplateInput): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>You have been invited</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;background:#fff;border:1px solid #e4e4e7;border-radius:8px;">
        <tr><td style="padding:32px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:22px;">${greeting}</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:22px;">${invitedBy} to join Work Orders as a <strong>${roleLabel}</strong>.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="${acceptUrl}" style="display:inline-block;padding:10px 18px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">Accept invitation</a>
          </p>
          <p style="margin:0;font-size:13px;line-height:20px;color:#71717a;">Or copy this link into your browser:<br /><span style="word-break:break-all;color:#52525b;">${acceptUrl}</span></p>
          <p style="margin:24px 0 0;font-size:13px;line-height:20px;color:#71717a;">This invitation will expire. If you did not expect it, you can ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function renderInvitationText({
  greeting,
  invitedBy,
  roleLabel,
  acceptUrl,
}: InvitationTemplateInput): string {
  return [
    greeting,
    '',
    `${invitedBy} to join Work Orders as a ${roleLabel}.`,
    '',
    `Accept invitation: ${acceptUrl}`,
    '',
    'This invitation will expire. If you did not expect it, you can ignore this email.',
  ].join('\n')
}
