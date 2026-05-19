import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  STATUS_LABELS,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type Property,
  type WorkOrderStatus,
} from '@/lib/schemas/work-order'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'My Work Orders' }

type WorkOrderRow = {
  id: string
  category: WorkOrderCategory
  status: WorkOrderStatus
  property: Property | null
  unit_number: string | null
  priority: WorkOrderPriority
  due_at: string | null
  description: string
  reported_by_name: string | null
  created_at: string
}

const STATUS_COLOR: Record<WorkOrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  open: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  assigned: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  closed: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700/30 dark:text-zinc-300',
  rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
}

const PRIORITY_COLOR: Record<WorkOrderPriority, string> = {
  urgent: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  low: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300',
}

const ROW_LIMIT = 100

export default async function MyWorkOrdersPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as { sub?: string } | undefined

  if (!claims?.sub) redirect('/login')

  const { data, error } = await supabase
    .from('work_orders')
    .select(
      'id, category, status, property, unit_number, priority, due_at, description, reported_by_name, created_at'
    )
    .eq('assigned_to', claims.sub)
    .not('status', 'in', '(pending,rejected)')
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT)

  const workOrders = (data ?? []) as WorkOrderRow[]

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

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {workOrders.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            You don&apos;t have any work orders assigned yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Created
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Category
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Priority
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Property
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Unit
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Description
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Due
                </TableHead>
                <TableHead className="px-4 text-xs uppercase tracking-wide text-muted-foreground">
                  Reported by
                </TableHead>
                <TableHead className="px-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workOrders.map((wo) => (
                <TableRow key={wo.id}>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {formatDate(wo.created_at)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {CATEGORY_LABELS[wo.category]}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[wo.status]}`}
                    >
                      {STATUS_LABELS[wo.status]}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLOR[wo.priority]}`}
                    >
                      {PRIORITY_LABELS[wo.priority]}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {wo.property ? PROPERTY_LABELS[wo.property] : '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {wo.unit_number ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-xs truncate px-4 py-3">
                    {wo.description}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {wo.due_at ? formatDateTime(wo.due_at) : '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {wo.reported_by_name ?? '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Link
                      href={`/work-orders/${wo.id}/edit`}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
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

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
