import type { Metadata } from 'next'

import { InviteForm } from './invite-form'

export const metadata: Metadata = { title: 'Invite member' }

export default function InvitePage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Invite a member</h1>
        <p className="text-sm text-muted-foreground">
          Send an email invitation. The recipient sets their own password.
        </p>
      </div>
      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10 shadow-md dark:shadow-none">
        <InviteForm />
      </div>
    </div>
  )
}
