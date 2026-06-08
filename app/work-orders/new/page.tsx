import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { fetchAssignableUsers } from '@/lib/work-orders/assignable-users'

import { NewWorkOrderForm } from './new-work-order-form'

export const metadata: Metadata = { title: 'New Work Order' }

const FILER_ROLES = new Set(['administrator', 'requester'])

export default async function NewWorkOrderPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims as
    | {
        sub?: string
        email?: string
        user_role?: string
        user_metadata?: { first_name?: string; last_name?: string }
      }
    | undefined

  if (!claims) redirect('/login')
  if (!claims.user_role || !FILER_ROLES.has(claims.user_role)) {
    redirect('/work-orders')
  }

  // Default the reporter to whoever is creating the work order. The fields stay
  // editable, so a filer can change them to report on someone else's behalf.
  const reporterDefaults = {
    name:
      [claims.user_metadata?.first_name, claims.user_metadata?.last_name]
        .filter(Boolean)
        .join(' ') || undefined,
    email: claims.email,
  }

  const assignableUsers = await fetchAssignableUsers(supabase)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          New Work Order
        </h1>
        <p className="text-sm text-muted-foreground">
          File a new work order. The team will see it as soon as you submit.
        </p>
      </div>
      <NewWorkOrderForm
        reporterDefaults={reporterDefaults}
        assignableUsers={assignableUsers}
      />
    </div>
  )
}
