import { RiAddLine, RiRepeatLine } from '@remixicon/react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { CategoryBadge } from '@/components/work-orders/work-order-badge'
import { formatDateTime } from '@/lib/datetime/format'
import { getTimeZone } from '@/lib/datetime/timezone'
import {
  FREQUENCY_LABELS,
  PROPERTY_LABELS,
  type Property,
  type RecurrenceFrequency,
  type WorkOrderCategory,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'
import {
  fetchAssignableUsers,
  formatAssigneeLabel,
} from '@/lib/work-orders/assignable-users'

export const metadata: Metadata = { title: 'Recurring Work Orders' }

const FILER_ROLES = new Set(['administrator', 'requester'])

type RecurringRow = {
  id: string
  title: string
  category: WorkOrderCategory
  property: Property | null
  unit_number: string | null
  provider: string | null
  frequency: RecurrenceFrequency
  next_due_at: string | null
  reminder_lead_days: number
  assigned_to: string | null
  active: boolean
}

export default async function RecurringWorkOrdersPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as { user_role?: string } | undefined

  if (!claims) redirect('/login')

  const [{ data, error }, assignableUsers, timeZone] = await Promise.all([
    supabase
      .from('recurring_work_orders')
      .select(
        'id, title, category, property, unit_number, provider, frequency, next_due_at, reminder_lead_days, assigned_to, active'
      )
      .order('active', { ascending: false })
      .order('next_due_at', { ascending: true, nullsFirst: false })
      .returns<RecurringRow[]>(),
    fetchAssignableUsers(supabase),
    getTimeZone(),
  ])

  const userLabelById = new Map(
    assignableUsers.map((u) => [u.user_id, formatAssigneeLabel(u)])
  )
  const canFile = claims.user_role ? FILER_ROLES.has(claims.user_role) : false
  const rows = data ?? []

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            Recurring Work Orders
          </h1>
          <p className="text-sm text-muted-foreground">
            Schedules that file a work order and email a reminder before each due
            date.
          </p>
        </div>
        {canFile ? (
          <Link
            href="/work-orders/new"
            className={buttonVariants({ size: 'lg' })}
          >
            <RiAddLine className="size-4" />
            New recurring order
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState canFile={canFile} />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Next due</th>
                <th className="px-4 py-3">Reminder</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-0 align-top"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{row.title}</div>
                    {row.provider ? (
                      <div className="text-xs text-muted-foreground">
                        {row.provider}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={row.category} />
                  </td>
                  <td className="px-4 py-3">{FREQUENCY_LABELS[row.frequency]}</td>
                  <td className="px-4 py-3">
                    {row.property ? (
                      PROPERTY_LABELS[row.property]
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.next_due_at ? (
                      formatDateTime(row.next_due_at, timeZone)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.reminder_lead_days} days before
                  </td>
                  <td className="px-4 py-3">
                    {row.assigned_to ? (
                      (userLabelById.get(row.assigned_to) ?? '—')
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline">Ended</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EmptyState({ canFile }: { canFile: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <RiRepeatLine className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">No recurring work orders yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Create a work order in the License or Compliance category and choose a
        frequency to make it recurring.
      </p>
      {canFile ? (
        <Link
          href="/work-orders/new"
          className={buttonVariants({ variant: 'outline' })}
        >
          Create one now
        </Link>
      ) : null}
    </div>
  )
}
