import type { Metadata } from 'next'

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
}

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const currentUserId = (claimsData?.claims as { sub?: string } | undefined)
    ?.sub

  const { data, error } = await supabase.rpc('admin_list_users')
  const users = (data ?? []) as AdminUserRow[]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Everyone with access to this workspace. Change a role to update
          someone&apos;s permissions immediately.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {users.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const name = [u.first_name, u.last_name]
                  .filter(Boolean)
                  .join(' ')
                const isSelf = u.user_id === currentUserId
                return (
                  <tr
                    key={u.user_id}
                    className="border-b last:border-b-0 align-middle"
                  >
                    <td className="px-4 py-3">{name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <RoleSelect
                        userId={u.user_id}
                        currentRole={u.role ?? 'requester'}
                        disabled={isSelf}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
