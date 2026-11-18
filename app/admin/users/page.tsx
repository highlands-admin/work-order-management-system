import type { Metadata } from 'next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime } from '@/lib/datetime/format'
import { getTimeZone } from '@/lib/datetime/timezone'
import { createClient } from '@/lib/supabase/server'
import { type AppRole } from '@/lib/schemas/admin'

import { RoleSelect } from './role-select'

export const metadata: Metadata = { title: 'Users' }

type AdminUserRow = {
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: AppRole | null
  created_at: string
  last_sign_in_at: string | null
  is_owner: boolean
}

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const currentUserId = (claimsData?.claims as { sub?: string } | undefined)
    ?.sub

  const [{ data, error }, { data: ownerData }] = await Promise.all([
    supabase.rpc('admin_list_users'),
    supabase.rpc('is_org_owner'),
  ])
  const viewerIsOwner = ownerData === true
  const users = (data ?? []) as AdminUserRow[]
  const timeZone = await getTimeZone()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Everyone with access to this workspace. Change a role to update
          someone&apos;s permissions immediately.{' '}
          {viewerIsOwner
            ? 'As an organization owner, you can also promote and demote administrators.'
            : 'Only organization owners can add or change administrators.'}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-md dark:shadow-none">
        {users.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No users yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Email
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Role
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Last sign-in
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const name = [u.first_name, u.last_name]
                  .filter(Boolean)
                  .join(' ')
                const isSelf = u.user_id === currentUserId
                const isAdmin = u.role === 'administrator'
                // Owners are changed by Highlands only. Other administrators
                // can be changed by owners only.
                const locked =
                  isSelf || u.is_owner || (isAdmin && !viewerIsOwner)
                return (
                  <TableRow key={u.user_id}>
                    <TableCell className="px-4 py-3">
                      <span className="flex flex-wrap items-center gap-2">
                        {name || '—'}
                        {u.is_owner ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Owner
                          </span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <RoleSelect
                        userId={u.user_id}
                        currentRole={u.role ?? 'requester'}
                        disabled={locked}
                        allowAdministrator={viewerIsOwner}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {u.last_sign_in_at
                        ? formatDateTime(u.last_sign_in_at, timeZone)
                        : '—'}
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
