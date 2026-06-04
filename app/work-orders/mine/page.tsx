import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { WorkOrdersTable, type WorkOrderListItem } from '../work-orders-table'

export const metadata: Metadata = { title: 'My Work Orders' }

const ROW_LIMIT = 100

export default async function MyWorkOrdersPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as { sub?: string } | undefined

  if (!claims?.sub) redirect('/login')

  const { data, error } = await supabase
    .from('work_orders')
    .select(
      'id, work_order_code, title, category, status, property, unit_number, priority, due_at, reported_by_name, created_at'
    )
    .eq('assigned_to', claims.sub)
    .not('status', 'in', '(pending,rejected)')
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT)

  const workOrders = (data ?? []) as WorkOrderListItem[]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">My Work Orders</h1>
        <p className="text-sm text-muted-foreground">
          Work orders assigned to you, newest first.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}

      <WorkOrdersTable
        workOrders={workOrders}
        emptyMessage="You don't have any work orders assigned yet."
      />
    </div>
  )
}
