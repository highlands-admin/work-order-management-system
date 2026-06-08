// Work order assignment notification. HTML and plain-text are kept side by side
// so they stay in sync; Resend sends both MIME parts.

type AssignmentRow = { label: string; value: string }

type AssignmentTemplateInput = {
  greeting: string
  intro: string
  code: string
  title: string
  rows: AssignmentRow[]
  description: string
  url: string
}

export function renderWorkOrderAssignmentHtml({
  greeting,
  intro,
  code,
  title,
  rows,
  description,
  url,
}: AssignmentTemplateInput): string {
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#71717a;white-space:nowrap;vertical-align:top;">${escapeHtml(
          r.label
        )}</td><td style="padding:4px 0;font-size:13px;color:#18181b;">${escapeHtml(
          r.value
        )}</td></tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Work order assigned to you</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;background:#fff;border:1px solid #e4e4e7;border-radius:8px;">
        <tr><td style="padding:32px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:22px;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:22px;">${escapeHtml(intro)}</p>

          <p style="margin:0 0 2px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#0f766e;">${escapeHtml(code)}</p>
          <p style="margin:0 0 16px;font-size:18px;font-weight:600;line-height:24px;">${escapeHtml(title)}</p>

          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7;margin:0 0 16px;padding:8px 0;">
            ${rowsHtml}
          </table>

          <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#71717a;">Description</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:21px;white-space:pre-line;color:#3f3f46;">${escapeHtml(description)}</p>

          <p style="margin:0 0 8px;text-align:center;">
            <a href="${url}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">View work order</a>
          </p>
          <p style="margin:0;font-size:13px;line-height:20px;color:#71717a;text-align:center;"><span style="word-break:break-all;color:#52525b;">${url}</span></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function renderWorkOrderAssignmentText({
  greeting,
  intro,
  code,
  title,
  rows,
  description,
  url,
}: AssignmentTemplateInput): string {
  return [
    greeting,
    '',
    intro,
    '',
    `${code} — ${title}`,
    '',
    ...rows.map((r) => `${r.label}: ${r.value}`),
    '',
    'Description:',
    description,
    '',
    `View work order: ${url}`,
  ].join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
