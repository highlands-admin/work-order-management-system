import type { Metadata } from 'next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS, type AppRole } from '@/lib/schemas/admin'

import {
  resendInvitationAction,
  revokeInvitationAction,
} from '../actions'

export const metadata: Metadata = { title: 'Invitations' }

type Invitation = {
  id: string
  email: string
  role: AppRole
  first_name: string | null
  last_name: string | null
  token: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
}

type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

function statusOf(invite: Invitation): InviteStatus {
  if (invite.accepted_at) return 'accepted'
  if (invite.revoked_at) return 'revoked'
  if (new Date(invite.expires_at).getTime() <= Date.now()) return 'expired'
  return 'pending'
}

const STATUS_LABEL: Record<InviteStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  revoked: 'Revoked',
  expired: 'Expired',
}

const STATUS_COLOR: Record<InviteStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  revoked: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700/30 dark:text-zinc-300',
  expired: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
}

export default async function InvitationsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invitations')
    .select(
      'id, email, role, first_name, last_name, token, expires_at, accepted_at, revoked_at, created_at'
    )
    .order('created_at', { ascending: false })

  const invitations = (data ?? []) as Invitation[]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Invitations</h1>
        <p className="text-sm text-muted-foreground">
          All invitations issued for this workspace.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {invitations.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No invitations yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Email
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Role
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Sent
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Expires
                </TableHead>
                <TableHead className="px-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invite) => {
                const status = statusOf(invite)
                return (
                  <TableRow key={invite.id}>
                    <TableCell className="px-4 py-3">{invite.email}</TableCell>
                    <TableCell className="px-4 py-3">
                      {ROLE_LABELS[invite.role]}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {formatDate(invite.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {formatDate(invite.expires_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {status === 'pending' || status === 'expired' ? (
                        <div className="flex justify-end gap-2">
                          <form action={resendInvitationAction}>
                            <input
                              type="hidden"
                              name="invitationId"
                              value={invite.id}
                            />
                            <button
                              type="submit"
                              className="rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                            >
                              Resend
                            </button>
                          </form>
                          {status === 'pending' ? (
                            <form action={revokeInvitationAction}>
                              <input
                                type="hidden"
                                name="invitationId"
                                value={invite.id}
                              />
                              <button
                                type="submit"
                                className="rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                              >
                                Revoke
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
