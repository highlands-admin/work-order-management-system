import { Resend } from 'resend'

// Every sender goes through this instead of `new Resend()`. In staging,
// EMAIL_ALLOWLIST (comma-separated addresses) limits who can receive mail, so a
// copy of production data never emails real requesters or approvers by
// accident. Unset in production: every recipient gets the mail, unchanged.

type SendArgs = Parameters<Resend['emails']['send']>[0]
type Recipients = string | string[] | undefined

function allowlist(): Set<string> | null {
  const raw = process.env.EMAIL_ALLOWLIST?.trim()
  if (!raw) return null
  return new Set(
    raw
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean)
  )
}

// Accepts "a@b.c" and "Name <a@b.c>".
function address(recipient: string): string {
  const match = recipient.match(/<([^>]+)>/)
  return (match ? match[1] : recipient).trim().toLowerCase()
}

function keep(list: Recipients, allowed: Set<string>): string[] {
  if (!list) return []
  return (Array.isArray(list) ? list : [list]).filter((r) =>
    allowed.has(address(r))
  )
}

export function createEmailClient(apiKey: string) {
  const resend = new Resend(apiKey)
  return {
    emails: {
      async send(args: SendArgs): Promise<{ error: { message: string } | null }> {
        const allowed = allowlist()
        if (!allowed) return resend.emails.send(args)

        const to = keep(args.to, allowed)
        if (to.length === 0) {
          // Counts only: recipients are personal data.
          console.info('[email] EMAIL_ALLOWLIST: message not sent, no allowed recipients')
          return { error: null }
        }
        const cc = keep(args.cc, allowed)
        const bcc = keep(args.bcc, allowed)
        return resend.emails.send({
          ...args,
          to,
          cc: cc.length ? cc : undefined,
          bcc: bcc.length ? bcc : undefined,
        } as SendArgs)
      },
    },
  }
}
